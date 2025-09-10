<template>
  <div class="pdf-viewer">
    <div class="pdf-toolbar">
      <!-- Navigation Controls -->
      <div class="pdf-controls">
        <button @click="previousPage" :disabled="currentPage <= 1" class="btn">
          ← Previous
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button @click="nextPage" :disabled="currentPage >= totalPages" class="btn">
          Next →
        </button>
      </div>

      <!-- Unstable: temporary disabled  -->
      <!-- Zoom Controls -->
      <!-- <div class="zoom-controls">
        <button @click="zoomOut" class="btn">-</button>
        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
        <button @click="zoomIn" class="btn">+</button>
        <button @click="fitToWidth" class="btn">Fit Width</button>
      </div> -->

    </div>

    <!-- PDF Container -->
    <div class="pdf-container" ref="container">
      <div v-if="loading" class="loading">
        Loading PDF...
      </div>
      <div v-if="error" class="error">
        {{ error }}
      </div>
      <canvas
        v-show="!loading && !error"
        ref="canvas"
        style="pointer-events: none;"
        class="pdf-canvas"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, toRaw } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'

// Props
const props = defineProps({
  pdfUrl: {
    type: String,
    default: null
  },
  initialPage: {
    type: Number,
    default: 1
  },
  initialScale: {
    type: Number,
    default: 3.2
  }
})

// Expose public methods
const emit = defineEmits(['page-rendered'])

// References
const canvas = ref(null)
const container = ref(null)
const fileInput = ref(null)

// State
const pdfDoc = ref(null)
const currentPage = ref(props.initialPage)
const totalPages = ref(0)
const scale = ref(props.initialScale)
const loading = ref(false)
const error = ref(null)
const renderTask = ref(null)

// Configure PDF.js worker
// Use CDN for the modern `.mjs` worker (compatible with modules)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.mjs'

// Load PDF from URL
const loadPDFFromUrl = async (url) => {
  loading.value = true
  error.value = null

  try {
    const loadingTask = pdfjsLib.getDocument(url)

    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages

    currentPage.value = Math.min(currentPage.value, totalPages.value)

    await renderPage()
  } catch (err) {
    error.value = `Failed to load PDF: ${err.message}`
    console.error('PDF loading error:', err)
  } finally {
    loading.value = false
  }
}

// Handle file upload
const loadPDF = async (event) => {
  const file = event.target.files[0]
  if (!file || file.type !== 'application/pdf') {
    error.value = 'Please select a valid PDF file'
    return
  }

  loading.value = true
  error.value = null

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages
    currentPage.value = 1
    await renderPage()
  } catch (err) {
    error.value = `Failed to load PDF: ${err.message}`
    console.error('PDF loading error:', err)
  } finally {
    loading.value = false
  }
}

// Render current page
const renderPage = async () => {
  if (!pdfDoc.value) return

  // Cancel any ongoing render
  if (renderTask.value) {
    toRaw(renderTask.value).cancel()
    renderTask.value = null
  }

  try {
    const page = await toRaw(pdfDoc.value).getPage(currentPage.value)
    const canvasEl = canvas.value
    const context = canvasEl.getContext('2d')
    context.clearRect(0, 0, canvasEl.width, canvasEl.height);

    const viewport = page.getViewport({ scale: scale.value + 1 })
    // const devicePixelRatio = window.devicePixelRatio || 1
    // const outputScale = devicePixelRatio / window.matchMedia('(max-resolution: 1dppx)').matches ? 1 : devicePixelRatio

    // Set high-quality rendering
    // canvasEl.width = Math.floor(viewport.width * outputScale)
    // canvasEl.height = Math.floor(viewport.height * outputScale)
    // canvasEl.style.width = `${Math.floor(viewport.width)}px`
    // canvasEl.style.height = `${Math.floor(viewport.height)}px`
    // context.setTransform(outputScale, 0, 0, outputScale, 0, 0)
    
    canvasEl.height = viewport.height;
    canvasEl.width = viewport.width;

    const pageWidthScale = container.clientWidth / page.view[2];
    const pageHeightScale = container.clientHeight / page.view[3];

    var displayWidth =  Math.min(pageWidthScale, pageHeightScale);
    canvasEl.style.width = `${(viewport.width * displayWidth) / scale}px`;
    canvasEl.style.height = `${(viewport.height * displayWidth) / scale}px`;

    const renderContext = {
      canvasContext: context,
      viewport
    }

    renderTask.value = page.render(renderContext)
    await toRaw(renderTask.value).promise
    renderTask.value = null

    // Emit event
    emit('page-rendered', {
      page: currentPage.value,
      totalPages: totalPages.value,
      scale: scale.value
    })
  } catch (err) {
    if (err.name !== 'RenderingCancelledException') {
      console.error('Rendering error:', err)
      error.value = `Failed to render page: ${err.message}`
    }
  }
}

// Page navigation
const previousPage = async () => {
  if (currentPage.value > 1) {
    currentPage.value--
    await renderPage()
  }
}

const nextPage = async () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    await renderPage()
  }
}

// Zoom functions
const zoomIn = async () => {
  scale.value = Math.min(scale.value * 1.2, 3.0)
  await renderPage()
}

const zoomOut = async () => {
  scale.value = Math.max(scale.value / 1.2, 0.5)
  await renderPage()
}

const fitToWidth = async () => {
  if (!pdfDoc.value || !container.value) return

  try {
    const page = await toRaw(pdfDoc.value).getPage(currentPage.value)
    const viewport = page.getViewport({ scale: 1.0 })
    const containerWidth = container.value.clientWidth - 40 // account for padding

    console.log('> containerWidth | PdfViewer.vue line 229', { containerWidth })
    console.log('> viewport.width | PdfViewer.vue line 230', { viewport: viewport.width })

    scale.value = containerWidth / viewport.width

    console.log('> scale.value | PdfViewer.vue line 231', { scale: scale.value })
    await renderPage()
  } catch (err) {
    console.error('Fit to width error:', err)
  }
}

// Public methods (exposed via `defineExpose`)
const goToPage = async (pageNumber) => {
  if (pageNumber >= 1 && pageNumber <= totalPages.value) {
    currentPage.value = pageNumber
    await renderPage()
  }
}

const setScale = async (newScale) => {
  scale.value = Math.max(0.5, Math.min(3.0, newScale))
  await renderPage()
}

defineExpose({
  goToPage,
  setScale,
  renderPage
})

// Initial render after mount
onMounted(async () => {
  // Ensure canvas and container are ready
  await nextTick()
  if (props.pdfUrl) {
    await loadPDFFromUrl(props.pdfUrl)
  }
})
</script>

<style scoped>
.pdf-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f5f5f5;
}

.pdf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  flex-wrap: wrap;
  gap: 10px;
}

.pdf-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #ccc;
  background-color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn:hover:not(:disabled) {
  background-color: #f0f0f0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.zoom-level {
  font-size: 14px;
  color: #666;
  min-width: 45px;
  text-align: center;
}

.file-input {
  max-width: 200px;
}

.pdf-container {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #f9f9f9;
}

.pdf-canvas {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  background-color: white;
  max-width: 100%;
  height: auto;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  color: #666;
  height: 200px;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  color: #d32f2f;
  background-color: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
  padding: 20px;
  margin: 20px;
}

@media (max-width: 768px) {
  .pdf-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .pdf-controls,
  .zoom-controls {
    justify-content: center;
  }

  .file-input {
    max-width: none;
  }
}
</style>