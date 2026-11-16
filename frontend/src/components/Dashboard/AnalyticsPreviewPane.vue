<template>
	<section
		class="flex min-w-0 shrink-0 grow flex-col bg-surface-gray-1 md:min-h-0 md:flex-1 md:shrink"
		:aria-label="__('Preview')"
	>
		<header class="shrink-0 pb-3 pe-14 ps-6 pt-6" aria-live="polite">
			<h3 class="text-base font-semibold text-ink-gray-8">
				{{ __('Preview') }}
			</h3>
			<p class="mt-1 min-h-5 text-p-sm text-ink-gray-6">
				{{ summary }}
			</p>
		</header>
		<div
			v-if="showsContent"
			class="min-h-0 flex-1 overflow-auto overscroll-contain px-6 pb-6 [scrollbar-gutter:stable]"
			tabindex="0"
			:aria-label="__('Preview of the export')"
			role="group"
		>
			<AnalyticsSheetPreview
				v-if="preview?.sheet"
				:sheet="preview.sheet"
				:hidden-rows="preview.students - preview.shown"
			/>
			<AnalyticsReportFrame
				v-else-if="preview?.html"
				:html="preview.html"
				:page="reportPage(format)"
			/>
		</div>
		<div
			v-else-if="loading"
			class="flex min-h-64 flex-1 flex-col gap-3 px-6 pb-6"
			role="status"
			:aria-label="__('Loading preview')"
		>
			<div
				v-for="row in 8"
				:key="row"
				class="flex items-center gap-4"
				aria-hidden="true"
			>
				<Skeleton class="h-2 w-6 shrink-0 rounded-full" />
				<Skeleton
					class="h-2 rounded-full"
					:class="row === 1 ? 'w-40' : 'w-32'"
				/>
				<Skeleton class="h-2 w-24 rounded-full" />
				<Skeleton class="h-2 w-16 rounded-full" />
			</div>
		</div>
		<LoadError
			v-else-if="error"
			compact
			:error="failure ?? { name: 'Error' }"
			@retry="emit('retry')"
		/>
		<EmptyStateLayout
			v-else-if="preview"
			name="Students"
			width="lg"
			icon="lucide-users"
			:title="__('No students in this time frame')"
			:description="__('Pick a wider time frame to have something to export.')"
		/>
		<EmptyStateLayout
			v-else
			name="Preview"
			width="lg"
			icon="lucide-calendar"
			:title="__('Pick a date range')"
			:description="
				__('Choose both days, in order, to see what the export will hold.')
			"
		/>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Skeleton } from 'frappe-ui'
import AnalyticsReportFrame from '@/components/Dashboard/AnalyticsReportFrame.vue'
import AnalyticsSheetPreview from '@/components/Dashboard/AnalyticsSheetPreview.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import LoadError from '@/components/LoadError.vue'
import { reportPage } from '@/utils/dashboard/export'
import type { AnalyticsFormat, AnalyticsPreview } from '@/types'

const props = defineProps<{
	format: AnalyticsFormat
	preview: AnalyticsPreview | null
	loading: boolean
	error: string
	failure?: { name?: string; status?: number; exc_type?: string } | null
}>()

const emit = defineEmits<{
	retry: []
}>()

const showsContent = computed<boolean>(() => Boolean(props.preview?.students))

const summary = computed<string>(() => {
	if (!props.preview) return ''
	const { students, shown } = props.preview
	const count =
		students === 1
			? __('1 student in this export.')
			: __('{0} students in this export.').format(String(students))
	if (shown === students) return count
	const cap =
		props.format === 'png'
			? __('The image stops at {0}.').format(String(shown))
			: __('Showing the first {0}, the file has them all.').format(
					String(shown)
			  )
	return `${count} ${cap}`
})
</script>
