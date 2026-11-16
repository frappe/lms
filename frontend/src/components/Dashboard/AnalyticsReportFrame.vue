<template>
	<div ref="bounds" class="w-full">
		<div
			v-if="height"
			dir="ltr"
			class="mx-auto overflow-hidden rounded shadow-sm"
			:style="{
				width: `${page.width * scale}px`,
				height: `${height * scale}px`,
			}"
		>
			<iframe
				sandbox=""
				class="origin-top-left border-0"
				:title="__('Preview of the report')"
				:srcdoc="reportDocument(html, page)"
				:style="{
					width: `${page.width}px`,
					height: `${height}px`,
					transform: `scale(${scale})`,
				}"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { measureReport, reportDocument } from '@/utils/dashboard/export'
import type { ReportPage } from '@/utils/dashboard/export'

const props = defineProps<{
	html: string
	page: ReportPage
}>()

const { width: available } = useElementSize(useTemplateRef('bounds'))
const height = ref<number>(0)
const scale = computed<number>(() =>
	Math.min(1, available.value / props.page.width)
)

// The frame that shows the report has no same origin, so it cannot be asked how
// tall the report came out; a throwaway one that can be asked measures it first.
watch(
	() => [props.html, props.page] as const,
	async ([html, page], _previous, onCleanup) => {
		let stale = false
		onCleanup(() => (stale = true))
		const measured = await measureReport(html, page)
		if (!stale) height.value = measured.height
	},
	{ immediate: true }
)
</script>
