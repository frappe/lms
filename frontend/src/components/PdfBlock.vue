<template>
	<div class="pdf-block mb-4">
		<div class="pdf-toolbar">
			<div class="pdf-toolbar-group">
				<button
					type="button"
					class="pdf-btn"
					:disabled="loading || !!error || currentPage <= 1"
					aria-label="Previous page"
					@click="goToPage(currentPage - 1)"
				>
					<ChevronLeft :size="18" :stroke-width="1.5" />
				</button>
				<span class="pdf-page-indicator">{{
					numPages ? currentPage + ' / ' + numPages : '-'
				}}</span>
				<button
					type="button"
					class="pdf-btn"
					:disabled="loading || !!error || currentPage >= numPages"
					aria-label="Next page"
					@click="goToPage(currentPage + 1)"
				>
					<ChevronRight :size="18" :stroke-width="1.5" />
				</button>
			</div>
			<div class="pdf-toolbar-group">
				<button
					type="button"
					class="pdf-btn"
					:disabled="loading || !!error"
					aria-label="Zoom out"
					@click="zoomOut"
				>
					<ZoomOut :size="18" :stroke-width="1.5" />
				</button>
				<button
					type="button"
					class="pdf-btn"
					:disabled="loading || !!error"
					aria-label="Fit width"
					@click="fitWidth"
				>
					<Maximize2 :size="16" :stroke-width="1.5" />
				</button>
				<button
					type="button"
					class="pdf-btn"
					:disabled="loading || !!error"
					aria-label="Zoom in"
					@click="zoomIn"
				>
					<ZoomIn :size="18" :stroke-width="1.5" />
				</button>
				<a
					class="pdf-btn"
					:href="safeUrl(file)"
					v-external
					aria-label="Open in new tab"
				>
					<ExternalLink :size="16" :stroke-width="1.5" />
				</a>
			</div>
		</div>

		<div ref="scrollEl" class="pdf-scroll" @scroll.passive="scheduleUpdate">
			<div v-if="loading" class="pdf-status">
				<Loader2 :size="20" :stroke-width="1.5" class="pdf-spin" />
				<span>Loading PDF…</span>
			</div>
			<div v-else-if="error" class="pdf-status pdf-error">
				<span>{{ error }}</span>
				<a class="pdf-fallback-link" :href="safeUrl(file)" v-external>
					Open the PDF in a new tab
				</a>
			</div>
			<div
				v-for="(meta, i) in pageMeta"
				v-else
				:key="i"
				:ref="(el) => setPageEl(el, i)"
				class="pdf-page"
				:style="{
					width: Math.floor(meta.width * scale) + 'px',
					height: Math.floor(meta.height * scale) + 'px',
				}"
			>
				<canvas :ref="(el) => setCanvasEl(el, i)"></canvas>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { createPdfWorker } from '@/utils/pdfWorker'
import {
	ChevronLeft,
	ChevronRight,
	ZoomIn,
	ZoomOut,
	Maximize2,
	ExternalLink,
	Loader2,
} from 'lucide-vue-next'
import { safeUrl } from '@/utils/safeUrl'

const props = defineProps({
	file: { type: String, required: true },
})

// iOS Safari blanks a canvas past its area/memory limit: pdf.js's own failure
// mode on large or high-DPI pages. Cap the backing store to pdf.js's default.
const MAX_CANVAS_PIXELS = 16_777_216
const MIN_SCALE = 0.25
const MAX_SCALE = 5

const scrollEl = ref(null)
const loading = ref(true)
const error = ref(null)
const numPages = ref(0)
const currentPage = ref(1)
const scale = ref(1)
const pageMeta = ref([]) // per-page { width, height } at scale 1

// Heavy pdf.js objects are kept out of Vue reactivity on purpose.
let pdfjsLib = null
let pdfDoc = null
let pageEls = []
let canvasEls = []
let renderTasks = [] // active RenderTask per page index
let rendered = [] // bool per page index
let rafId = null
let task = null // in-flight PDFDocumentLoadingTask

// --- shared, ref-counted worker (multi-instance safe; terminated on last unmount) ---
// A leaked pdf.js worker is worse than a leaked <audio>, so we always release it.
// The ref is taken synchronously at mount and dropped on unmount, so an unmount
// that races an in-flight load() can never strand a ref (and its worker).
let heldWorker = false
let disposed = false

function setPageEl(el, i) {
	if (el) pageEls[i] = el
}
function setCanvasEl(el, i) {
	if (el) canvasEls[i] = el
}

async function load() {
	try {
		// Dynamic import: there is no manualChunks here, so a static import would
		// fold ~144kB gzip of pdf.js into the main entry that every LMS page pays.
		pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
		if (disposed) return
		// Wrap the raw port in our own PDFWorker and pass it explicitly. Via
		// GlobalWorkerOptions.workerPort, pdf.js hands each loading task
		// ownership of the shared worker, so one viewer's pdfDoc.destroy()
		// tears down the port-level message handler every *sibling* viewer is
		// still listening on. Their getDocument() then never settles and the
		// spinner runs forever. Passing `worker` keeps ownership here.
		if (sharedWorker && !sharedPdfWorker) {
			sharedPdfWorker = new pdfjsLib.PDFWorker({ port: sharedWorker })
		}

		const base = import.meta.env.BASE_URL || '/'
		const loadingTask = pdfjsLib.getDocument({
			url: safeUrl(props.file),
			worker: sharedPdfWorker || undefined,
			cMapUrl: `${base}pdfjs/cmaps/`,
			cMapPacked: true,
			standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
		})
		task = loadingTask
		pdfDoc = await loadingTask.promise
		task = null
		if (disposed) return
		numPages.value = pdfDoc.numPages

		// Fetch each page's intrinsic size (metadata only, no render) so the
		// continuous-scroll placeholders have correct heights up front.
		const meta = []
		for (let n = 1; n <= pdfDoc.numPages; n++) {
			const page = await pdfDoc.getPage(n)
			const vp = page.getViewport({ scale: 1 })
			meta.push({ width: vp.width, height: vp.height })
		}
		if (disposed) return
		pageMeta.value = meta
		renderTasks = new Array(meta.length).fill(null)
		rendered = new Array(meta.length).fill(false)
		loading.value = false

		await nextFrame()
		if (disposed) return
		fitWidth()
	} catch (e) {
		loading.value = false
		error.value = 'This PDF could not be displayed.'
		// eslint-disable-next-line no-console
		console.error('PdfBlock: failed to load PDF', e)
	}
}

// Synchronous so the ref is taken at mount, before load()'s first await. The
// GlobalWorkerOptions.workerPort wiring happens later in load() once pdf.js is
// imported. pdf.js falls back to its main-thread worker if none is available.
function acquireWorker() {
	if (heldWorker) return
	heldWorker = true
	sharedWorkerRefs++
	if (!sharedWorker) {
		try {
			sharedWorker = createPdfWorker()
		} catch (e) {
			// No worker (blocked / unsupported) -> pdf.js falls back to its
			// main-thread fake worker. Slower, but the viewer still works.
			sharedWorker = null
			// eslint-disable-next-line no-console
			console.warn('PdfBlock: pdf.js worker unavailable', e)
		}
	}
}

function releaseWorker() {
	if (!heldWorker) return
	heldWorker = false
	sharedWorkerRefs = Math.max(0, sharedWorkerRefs - 1)
	// Not guarded on the per-instance `pdfjsLib`: an instance that unmounts
	// before its dynamic import resolves would otherwise strand a terminated
	// worker in module scope.
	if (sharedWorkerRefs === 0) {
		sharedPdfWorker?.destroy()
		sharedPdfWorker = null
		sharedWorker?.terminate()
		sharedWorker = null
	}
}

async function renderPage(i) {
	if (rendered[i] || renderTasks[i]) return
	const canvas = canvasEls[i]
	if (!canvas || !pdfDoc) return
	rendered[i] = true // claim the slot before awaiting to avoid double-render races
	try {
		const page = await pdfDoc.getPage(i + 1)
		const viewport = page.getViewport({ scale: scale.value })

		let outputScale = window.devicePixelRatio || 1
		let bw = Math.floor(viewport.width * outputScale)
		let bh = Math.floor(viewport.height * outputScale)
		if (bw * bh > MAX_CANVAS_PIXELS) {
			outputScale *= Math.sqrt(MAX_CANVAS_PIXELS / (bw * bh))
			bw = Math.floor(viewport.width * outputScale)
			bh = Math.floor(viewport.height * outputScale)
		}
		canvas.width = bw
		canvas.height = bh
		canvas.style.width = Math.floor(viewport.width) + 'px'
		canvas.style.height = Math.floor(viewport.height) + 'px'

		const task = page.render({
			canvasContext: canvas.getContext('2d'),
			viewport,
			transform:
				outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
		})
		renderTasks[i] = task
		await task.promise
		renderTasks[i] = null
	} catch (e) {
		renderTasks[i] = null
		rendered[i] = false
		// RenderingCancelledException on scale change / teardown is expected.
		if (e?.name !== 'RenderingCancelledException') {
			// eslint-disable-next-line no-console
			console.error('PdfBlock: failed to render page', i + 1, e)
		}
	}
}

function clearPage(i) {
	const task = renderTasks[i]
	if (task) {
		task.cancel()
		renderTasks[i] = null
	}
	rendered[i] = false
	const canvas = canvasEls[i]
	if (canvas) {
		canvas.width = 0
		canvas.height = 0
	}
}

// Render pages within a screenful of the viewport, clear the rest, and track
// the most-visible page as `currentPage`. Bounds memory so iOS doesn't OOM.
function updateVisible() {
	const el = scrollEl.value
	if (!el || loading.value || error.value) return
	const cRect = el.getBoundingClientRect()
	const margin = cRect.height
	let best = { i: 0, area: -1 }
	for (let i = 0; i < pageEls.length; i++) {
		const pel = pageEls[i]
		if (!pel) continue
		const r = pel.getBoundingClientRect()
		const near =
			r.bottom >= cRect.top - margin && r.top <= cRect.bottom + margin
		if (near) renderPage(i)
		else clearPage(i)
		const visible =
			Math.min(r.bottom, cRect.bottom) - Math.max(r.top, cRect.top)
		if (visible > best.area) best = { i, area: visible }
	}
	currentPage.value = best.i + 1
}

function scheduleUpdate() {
	if (rafId != null) return
	rafId = requestAnimationFrame(() => {
		rafId = null
		updateVisible()
	})
}

function nextFrame() {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function relayout() {
	// scale changed: drop every canvas, then re-render what's on screen.
	for (let i = 0; i < pageEls.length; i++) clearPage(i)
	scheduleUpdate()
}

function setScale(next) {
	const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
	if (clamped === scale.value) return
	scale.value = clamped
	nextFrame().then(relayout)
}

function zoomIn() {
	setScale(scale.value * 1.25)
}
function zoomOut() {
	setScale(scale.value * 0.8)
}
function fitWidth() {
	const el = scrollEl.value
	if (!el || !pageMeta.value.length) return
	const widest = Math.max(...pageMeta.value.map((m) => m.width))
	// leave room for scrollbar / padding
	const avail = el.clientWidth - 24
	if (widest > 0 && avail > 0) setScale(avail / widest)
}

function goToPage(n) {
	const target = Math.min(numPages.value, Math.max(1, n))
	const pel = pageEls[target - 1]
	const el = scrollEl.value
	if (pel && el) {
		el.scrollTop = pel.offsetTop
		currentPage.value = target
		scheduleUpdate()
	}
}

acquireWorker()
load()

onBeforeUnmount(() => {
	disposed = true
	if (rafId != null) cancelAnimationFrame(rafId)
	for (let i = 0; i < renderTasks.length; i++) {
		try {
			renderTasks[i]?.cancel()
		} catch (e) {
			/* already settled */
		}
	}
	renderTasks = []
	try {
		pdfDoc?.destroy()
		// A load that never resolved leaves pdfDoc null, so cancel the task too.
		task?.destroy()
	} catch (e) {
		/* noop */
	}
	pdfDoc = null
	task = null
	releaseWorker()
})

defineExpose({ fitWidth, goToPage })
</script>

<script>
// Module-scoped so every PdfBlock instance shares one pdf.js worker.
let sharedWorker = null
let sharedWorkerRefs = 0
// The pdf.js-side wrapper for `sharedWorker`. Owned here, never by a loading
// task, so one document's destroy() can't tear it out from under another's.
let sharedPdfWorker = null
</script>

<style scoped>
.pdf-block {
	border: 1px solid var(--gray-200, #e5e7eb);
	border-radius: 8px;
	overflow: hidden;
	background: var(--gray-50, #f9fafb);
}
.pdf-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 6px 8px;
	border-bottom: 1px solid var(--gray-200, #e5e7eb);
	background: var(--white, #fff);
}
.pdf-toolbar-group {
	display: flex;
	align-items: center;
	gap: 4px;
}
.pdf-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 28px;
	min-width: 28px;
	padding: 0 6px;
	border-radius: 6px;
	color: var(--gray-700, #374151);
	background: transparent;
	cursor: pointer;
	border: none;
}
.pdf-btn:hover:not(:disabled) {
	background: var(--gray-100, #f3f4f6);
}
.pdf-btn:disabled {
	opacity: 0.4;
	cursor: default;
}
.pdf-page-indicator {
	min-width: 56px;
	text-align: center;
	font-size: 13px;
	color: var(--gray-700, #374151);
	font-variant-numeric: tabular-nums;
}
.pdf-scroll {
	height: 700px;
	max-height: 80vh;
	overflow: auto;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 12px;
	/* Keep the browser's native pinch-zoom and panning on touch devices. */
	touch-action: pan-x pan-y pinch-zoom;
	-webkit-overflow-scrolling: touch;
}
.pdf-page {
	background: var(--white, #fff);
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
	flex: 0 0 auto;
}
.pdf-page canvas {
	display: block;
}
.pdf-status {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 40px 12px;
	color: var(--gray-600, #4b5563);
	font-size: 14px;
}
.pdf-error {
	flex-direction: column;
}
.pdf-fallback-link,
.pdf-status a {
	color: var(--blue-600, #2563eb);
	text-decoration: underline;
}
.pdf-spin {
	animation: pdf-spin 1s linear infinite;
}
@keyframes pdf-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
