<template>
	<div class="pdf-viewer-container w-full select-none" @contextmenu.prevent>
		<div v-if="isLoading" class="flex flex-col items-center justify-center py-12 space-y-3">
			<div class="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600"></div>
			<div class="text-sm text-gray-500 font-medium">{{ __('Loading document...') }}</div>
		</div>

		<div v-else-if="errorMessage" class="text-center py-12 text-red-500 font-medium bg-red-50 rounded-lg p-4 border border-red-200">
			{{ errorMessage }}
		</div>

		<div v-else class="pdf-pages-wrapper flex flex-col items-center space-y-6 w-full p-2 bg-gray-50 rounded-lg max-h-[80vh] overflow-y-auto border border-gray-200">
			<canvas
				v-for="page in totalPages"
				:key="page"
				:id="`pdf-canvas-${page}`"
				class="pdf-page-canvas max-w-full shadow-lg border border-gray-200 bg-white rounded"
			></canvas>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps<{
	src: string
}>()

const __ = ((window as any).__ as ((text: string) => string)) || ((text: string) => text)
const isLoading = ref<boolean>(true)
const errorMessage = ref<string | null>(null)
const totalPages = ref<number>(0)

// Dynamically load PDF.js script from a trusted public CDN
const loadPdfJs = (): Promise<any> => {
	return new Promise((resolve, reject) => {
		if ((window as any).pdfjsLib) {
			resolve((window as any).pdfjsLib)
			return
		}
		const script = document.createElement('script')
		script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'
		script.onload = () => resolve((window as any).pdfjsLib)
		script.onerror = () => reject(new Error('Failed to load PDF.js viewer library.'))
		document.head.appendChild(script)
	})
}

onMounted(async () => {
	try {
		const pdfjsLib = await loadPdfJs()
		// Set worker source
		pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'

		const loadingTask = pdfjsLib.getDocument(props.src)
		const pdf = await loadingTask.promise
		
		totalPages.value = pdf.numPages
		isLoading.value = false

		await nextTick()

		// Render each page sequentially
		for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
			const page = await pdf.getPage(pageNum)
			const viewport = page.getViewport({ scale: 1.5 })
			
			const canvas = document.getElementById(`pdf-canvas-${pageNum}`) as HTMLCanvasElement
			if (!canvas) continue

			const context = canvas.getContext('2d')
			if (!context) continue

			canvas.height = viewport.height
			canvas.width = viewport.width

			const renderContext = {
				canvasContext: context,
				viewport: viewport,
			}
			await page.render(renderContext).promise
		}
	} catch (err: any) {
		console.error(err)
		errorMessage.value = __('Could not load PDF document. Please try again later.')
		isLoading.value = false
	}
})
</script>

<style scoped>
.pdf-viewer-container {
	user-select: none;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
}
.pdf-pages-wrapper::-webkit-scrollbar {
	width: 6px;
}
.pdf-pages-wrapper::-webkit-scrollbar-track {
	background: transparent;
}
.pdf-pages-wrapper::-webkit-scrollbar-thumb {
	background-color: rgba(156, 163, 175, 0.5);
	border-radius: 3px;
}
</style>
