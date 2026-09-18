
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

				<span class="pdf-page-indicator">
					{{ numPages ? `${currentPage} / ${numPages}` : '-' }}
				</span>

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
					<Maximize2 :size="18" :stroke-width="1.5" />
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
					:href="safePdfUrl"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Open PDF in new tab"
				>
					<ExternalLink :size="18" :stroke-width="1.5" />
				</a>
			</div>
		</div>

		<div
			v-if="loading"
			class="pdf-status"
		>
			<Loader2 class="pdf-spin" :size="18" />
			<span>Loading PDF...</span>
		</div>

		<div
			v-else-if="error"
			class="pdf-status pdf-error"
		>
			<span>{{ error }}</span>

			<a
				class="pdf-fallback-link"
				:href="safePdfUrl"
				target="_blank"
				rel="noopener noreferrer"
			>
				Open PDF directly
			</a>
		</div>

		<div
			v-else
			ref="scrollEl"
			class="pdf-scroll"
			@scroll.passive="scheduleUpdate"
		>
			<div
				v-for="(meta, index) in pageMeta"
				:key="index"
				:ref="(el) => setPageEl(el, index)"
				class="pdf-page"
				:style="{
					width: `${meta.width * scale}px`,
					height: `${meta.height * scale}px`,
				}"
			>
				<canvas
					:ref="(el) => setCanvasEl(el, index)"
				></canvas>
			</div>
		</div>
	</div>
</template>

<script setup>
import {
	ref,
	computed,
	onMounted,
	onBeforeUnmount,
	nextTick,
} from 'vue'

import {
	ChevronLeft,
	ChevronRight,
	ZoomIn,
	ZoomOut,
	Maximize2,
	ExternalLink,
	Loader2,
} from 'lucide-vue-next'

import { createPdfWorker } from '@/utils/pdfWorker'
import { safeUrl } from '@/utils/safeUrl'

const props = defineProps({
	file: {
		type: String,
		required: true,
	},

	// Optional analytics information.
	session: {
		type: String,
		default: '',
	},

	activity: {
		type: String,
		default: '',
	},

	student: {
		type: String,
		default: '',
	},

	enableTelemetry: {
		type: Boolean,
		default: true,
	},
})

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const EVENT_DOCTYPE = 'LMS Activity Event'
const EVENT_TYPE = 'pdf_page_view'
const EVENT_API = '/api/method/frappe.client.insert'

const MAX_CANVAS_PIXELS = 16_777_216
const MIN_SCALE = 0.25
const MAX_SCALE = 5

const safePdfUrl = computed(() => safeUrl(props.file))

/*
|--------------------------------------------------------------------------
| Vue state
|--------------------------------------------------------------------------
*/

const scrollEl = ref(null)
const loading = ref(true)
const error = ref(null)
const numPages = ref(0)
const currentPage = ref(1)
const scale = ref(1)
const pageMeta = ref([])

/*
|--------------------------------------------------------------------------
| PDF state
|--------------------------------------------------------------------------
*/

let pdfjsLib = null
let pdfDoc = null
let loadingTask = null

let pageEls = []
let canvasEls = []
let renderTasks = []
let rendered = []

let rafId = null
let disposed = false

/*
|--------------------------------------------------------------------------
| Telemetry state
|--------------------------------------------------------------------------
*/

let lastTrackedPage = null
let trackedPages = new Set()

/*
|--------------------------------------------------------------------------
| Shared PDF worker
|--------------------------------------------------------------------------
*/

let sharedWorker = null
let sharedWorkerRefs = 0
let sharedPdfWorker = null

let heldWorker = false

/*
|--------------------------------------------------------------------------
| DOM references
|--------------------------------------------------------------------------
*/

function setPageEl(element, index) {
	if (element) {
		pageEls[index] = element
	}
}

function setCanvasEl(element, index) {
	if (element) {
		canvasEls[index] = element
	}
}

/*
|--------------------------------------------------------------------------
| Frappe helpers
|--------------------------------------------------------------------------
*/

function getCsrfToken() {
	return (
		window.frappe?.csrf_token ||
		document.querySelector('meta[name="csrf-token"]')?.content ||
		'None'
	)
}

async function sendLearningEvent(pageNumber) {
	if (!props.enableTelemetry) return

	if (!props.session || !props.activity) {
		console.warn(
			'PdfBlock: telemetry skipped because session or activity is missing',
		)
		return
	}

	const uniqueKey = `${props.activity}:${pageNumber}`

	// Prevent duplicate events for the same page in this viewer session.
	if (trackedPages.has(uniqueKey)) {
		return
	}

	trackedPages.add(uniqueKey)

	const eventDocument = {
		doctype: EVENT_DOCTYPE,

		event_type: EVENT_TYPE,

		session: props.session,

		activity: props.activity,

		student: props.student || window.frappe?.session?.user || '',

		page_number: pageNumber,

		event_time: new Date().toISOString().slice(0, 19),

		metadata: JSON.stringify({
			file: props.file,
			page: pageNumber,
			total_pages: numPages.value,
			scale: scale.value,
			source: 'PdfBlock',
		}),
	}

	try {
		const response = await fetch(EVENT_API, {
			method: 'POST',

			headers: {
				'Content-Type': 'application/json',
				'X-Frappe-CSRF-Token': getCsrfToken(),
			},

			credentials: 'same-origin',

			body: JSON.stringify({
				doc: JSON.stringify(eventDocument),
			}),
		})

		if (!response.ok) {
			throw new Error(
				`Telemetry request failed with status ${response.status}`,
			)
		}

		console.debug(
			`PdfBlock: page ${pageNumber} event saved successfully`,
		)
	} catch (eventError) {
		// Do not break PDF reading if telemetry fails.
		console.warn(
			'PdfBlock: failed to save learning event',
			eventError,
		)

		// Allow retry if the request failed.
		trackedPages.delete(uniqueKey)
	}
}

function trackCurrentPage(pageNumber) {
	if (!pageNumber || pageNumber === lastTrackedPage) {
		return
	}

	lastTrackedPage = pageNumber
	sendLearningEvent(pageNumber)
}

/*
|--------------------------------------------------------------------------
| Worker management
|--------------------------------------------------------------------------
*/

function acquireWorker() {
	if (heldWorker) return

	heldWorker = true
	sharedWorkerRefs += 1

	if (!sharedWorker) {
		try {
			sharedWorker = createPdfWorker()
		} catch (workerError) {
			sharedWorker = null

			console.warn(
				'PdfBlock: worker unavailable, using fallback worker',
				workerError,
			)
		}
	}
}

function releaseWorker() {
	if (!heldWorker) return

	heldWorker = false
	sharedWorkerRefs = Math.max(0, sharedWorkerRefs - 1)

	if (sharedWorkerRefs === 0) {
		try {
			sharedPdfWorker?.destroy()
		} catch {
			// Worker already destroyed.
		}

		sharedPdfWorker = null

		try {
			sharedWorker?.terminate()
		} catch {
			// Worker already terminated.
		}

		sharedWorker = null
	}
}

/*
|--------------------------------------------------------------------------
| PDF loading
|--------------------------------------------------------------------------
*/

async function load() {
	try {
		pdfjsLib = await import(
			'pdfjs-dist/legacy/build/pdf.mjs'
		)

		if (disposed) return

		if (sharedWorker && !sharedPdfWorker) {
			sharedPdfWorker = new pdfjsLib.PDFWorker({
				port: sharedWorker,
			})
		}

		const base = import.meta.env.BASE_URL || '/'

		const task = pdfjsLib.getDocument({
			url: safeUrl(props.file),

			worker: sharedPdfWorker || undefined,

			cMapUrl: `${base}pdfjs/cmaps/`,

			cMapPacked: true,

			standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
		})

		loadingTask = task

		pdfDoc = await task.promise

		loadingTask = null

		if (disposed) return

		numPages.value = pdfDoc.numPages

		const metadata = []

		for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
			const page = await pdfDoc.getPage(pageNumber)

			const viewport = page.getViewport({
				scale: 1,
			})

			metadata.push({
				width: viewport.width,
				height: viewport.height,
			})
		}

		if (disposed) return

		pageMeta.value = metadata

		renderTasks = new Array(metadata.length).fill(null)

		rendered = new Array(metadata.length).fill(false)

		loading.value = false

		await nextTick()

		await nextFrame()

		if (disposed) return

		fitWidth()

		scheduleUpdate()
	} catch (loadError) {
		loading.value = false

		error.value = 'This PDF could not be displayed.'

		console.error(
			'PdfBlock: failed to load PDF',
			loadError,
		)
	}
}

/*
|--------------------------------------------------------------------------
| Page rendering
|--------------------------------------------------------------------------
*/

async function renderPage(index) {
	if (rendered[index] || renderTasks[index]) {
		return
	}

	const canvas = canvasEls[index]

	if (!canvas || !pdfDoc) {
		return
	}

	rendered[index] = true

	try {
		const page = await pdfDoc.getPage(index + 1)

		const viewport = page.getViewport({
			scale: scale.value,
		})

		let outputScale = window.devicePixelRatio || 1

		let backingWidth = Math.floor(
			viewport.width * outputScale,
		)

		let backingHeight = Math.floor(
			viewport.height * outputScale,
		)

		const totalPixels = backingWidth * backingHeight

		if (totalPixels > MAX_CANVAS_PIXELS) {
			outputScale *= Math.sqrt(
				MAX_CANVAS_PIXELS / totalPixels,
			)

			backingWidth = Math.floor(
				viewport.width * outputScale,
			)

			backingHeight = Math.floor(
				viewport.height * outputScale,
			)
		}

		canvas.width = backingWidth
		canvas.height = backingHeight

		canvas.style.width = `${Math.floor(viewport.width)}px`
		canvas.style.height = `${Math.floor(viewport.height)}px`

		const context = canvas.getContext('2d')

		if (!context) {
			throw new Error('Canvas 2D context unavailable')
		}

		const renderTask = page.render({
			canvasContext: context,

			viewport,

			transform:
				outputScale !== 1
					? [
							outputScale,
							0,
							0,
							outputScale,
							0,
							0,
						]
					: null,
		})

		renderTasks[index] = renderTask

		await renderTask.promise

		renderTasks[index] = null
	} catch (renderError) {
		renderTasks[index] = null

		rendered[index] = false

		if (
			renderError?.name !==
			'RenderingCancelledException'
		) {
			console.error(
				'PdfBlock: failed to render page',
				index + 1,
				renderError,
			)
		}
	}
}

function clearPage(index) {
	const renderTask = renderTasks[index]

	if (renderTask) {
		try {
			renderTask.cancel()
		} catch {
			// Render task already completed.
		}

		renderTasks[index] = null
	}

	rendered[index] = false

	const canvas = canvasEls[index]

	if (canvas) {
		canvas.width = 0
		canvas.height = 0
	}
}

/*
|--------------------------------------------------------------------------
| Visibility and page tracking
|--------------------------------------------------------------------------
*/

function updateVisible() {
	const container = scrollEl.value

	if (!container || loading.value || error.value) {
		return
	}

	const containerRect = container.getBoundingClientRect()

	const margin = containerRect.height

	let bestPage = {
		index: 0,
		visibleArea: -1,
	}

	for (let index = 0; index < pageEls.length; index++) {
		const pageElement = pageEls[index]

		if (!pageElement) continue

		const pageRect = pageElement.getBoundingClientRect()

		const isNearViewport =
			pageRect.bottom >= containerRect.top - margin &&
			pageRect.top <= containerRect.bottom + margin

		if (isNearViewport) {
			renderPage(index)
		} else {
			clearPage(index)
		}

		const visibleHeight =
			Math.min(
				pageRect.bottom,
				containerRect.bottom,
			) -
			Math.max(
				pageRect.top,
				containerRect.top,
			)

		const visibleArea = Math.max(0, visibleHeight)

		if (visibleArea > bestPage.visibleArea) {
			bestPage = {
				index,
				visibleArea,
			}
		}
	}

	const detectedPage = bestPage.index + 1

	currentPage.value = detectedPage

	trackCurrentPage(detectedPage)
}

function scheduleUpdate() {
	if (rafId !== null) return

	rafId = requestAnimationFrame(() => {
		rafId = null

		updateVisible()
	})
}

function nextFrame() {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve())
	})
}

/*
|--------------------------------------------------------------------------
| Zoom and navigation
|--------------------------------------------------------------------------
*/

function relayout() {
	for (let index = 0; index < pageEls.length; index++) {
		clearPage(index)
	}

	scheduleUpdate()
}

function setScale(nextScale) {
	const nextValue = Math.min(
		MAX_SCALE,
		Math.max(MIN_SCALE, nextScale),
	)

	if (nextValue === scale.value) return

	scale.value = nextValue

	nextFrame().then(relayout)
}

function zoomIn() {
	setScale(scale.value * 1.25)
}

function zoomOut() {
	setScale(scale.value * 0.8)
}

function fitWidth() {
	const container = scrollEl.value

	if (!container || !pageMeta.value.length) {
		return
	}

	const widestPage = Math.max(
		...pageMeta.value.map((meta) => meta.width),
	)

	const availableWidth = container.clientWidth - 24

	if (widestPage > 0 && availableWidth > 0) {
		setScale(availableWidth / widestPage)
	}
}

function goToPage(pageNumber) {
	const targetPage = Math.min(
		numPages.value,
		Math.max(1, pageNumber),
	)

	const pageElement = pageEls[targetPage - 1]

	const container = scrollEl.value

	if (!pageElement || !container) return

	container.scrollTop = pageElement.offsetTop

	currentPage.value = targetPage

	trackCurrentPage(targetPage)

	scheduleUpdate()
}

/*
|--------------------------------------------------------------------------
| Lifecycle
|--------------------------------------------------------------------------
*/

onMounted(() => {
	acquireWorker()
	load()
})

onBeforeUnmount(() => {
	disposed = true

	if (rafId !== null) {
		cancelAnimationFrame(rafId)
		rafId = null
	}

	for (let index = 0; index < renderTasks.length; index++) {
		try {
			renderTasks[index]?.cancel()
		} catch {
			// Render task already completed.
		}
	}

	renderTasks = []

	try {
		pdfDoc?.destroy()
		loadingTask?.destroy()
	} catch {
		// PDF already destroyed.
	}

	pdfDoc = null
	loadingTask = null

	releaseWorker()
})

defineExpose({
	fitWidth,
	goToPage,
})
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
