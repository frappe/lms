<template>
	<DefineOptions>
		<div class="flex flex-col gap-1.5">
			<FormLabel :id="formatLabelId" :label="__('Format')" />
			<TabButtons
				v-model="format"
				:options="formatOptions"
				:aria-labelledby="formatLabelId"
				fluid
			/>
		</div>
		<FormControl
			v-model="timeFrame"
			type="select"
			variant="outline"
			:label="__('Time frame')"
			:options="timeFrameOptions"
		/>
		<div v-if="timeFrame === 'custom'" class="grid grid-cols-2 gap-3">
			<FormControl
				v-model="fromDate"
				type="date"
				variant="outline"
				:label="__('From')"
				:placeholder="__('Start date')"
			/>
			<FormControl
				v-model="toDate"
				type="date"
				variant="outline"
				:label="__('To')"
				:placeholder="__('End date')"
				:error="rangeError"
			/>
		</div>
	</DefineOptions>
	<DefinePreview>
		<AnalyticsPreviewPane
			:format="format"
			:preview="preview"
			:loading="loading"
			:error="error"
			:failure="failure"
			@retry="load()"
		/>
	</DefinePreview>
	<Dialog v-if="!isMobile" v-model:open="open" size="5xl" bare>
		<div
			data-analytics-export-sheet
			class="relative h-[min(700px,calc(100vh-96px))] text-ink-gray-8"
		>
			<Dialog.Close as-child>
				<Button
					class="!absolute end-4 top-4 z-10"
					size="sm"
					variant="ghost"
					icon="lucide-x"
					:aria-label="__('Close')"
				/>
			</Dialog.Close>
			<div
				class="flex h-full flex-col overflow-y-auto overscroll-contain md:flex-row md:overflow-hidden"
			>
				<div
					class="flex shrink-0 flex-col md:w-80 md:border-e md:border-outline-gray-1"
				>
					<Dialog.Title
						class="shrink-0 pb-4 pe-14 ps-6 pt-6 text-[16px] font-semibold text-ink-gray-8"
					>
						{{ __('Export analytics') }}
					</Dialog.Title>
					<div
						class="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-4 md:overflow-y-auto"
					>
						<ReuseOptions />
						<Dialog.Description class="text-p-sm text-ink-gray-6">
							{{ description }}
						</Dialog.Description>
					</div>
					<div class="shrink-0 px-6 pb-6 pt-2">
						<Button
							variant="solid"
							class="w-full"
							:label="__('Export')"
							:loading="exporting"
							:disabled="!canExport"
							@click="runExport"
						/>
					</div>
				</div>
				<ReusePreview />
			</div>
		</div>
	</Dialog>
	<MobilePage
		v-else-if="open"
		:title="__('Export analytics')"
		body-class="overflow-y-auto overscroll-contain"
		@close="open = false"
	>
		<template #actions>
			<Button
				variant="solid"
				:label="__('Export')"
				:loading="exporting"
				:disabled="!canExport"
				@click="runExport"
			/>
		</template>
		<div
			data-analytics-export-sheet
			class="flex min-h-full flex-col text-ink-gray-8"
		>
			<div class="flex flex-col gap-4 px-5 py-4">
				<ReuseOptions />
				<p class="text-p-sm text-ink-gray-6">
					{{ description }}
				</p>
			</div>
			<ReusePreview />
		</div>
	</MobilePage>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import {
	Button,
	Dialog,
	FormControl,
	FormLabel,
	TabButtons,
	toast,
} from 'frappe-ui'
import { createReusableTemplate } from '@vueuse/core'
import AnalyticsPreviewPane from '@/components/Dashboard/AnalyticsPreviewPane.vue'
import MobilePage from '@/components/MobilePage.vue'
import { useAnalyticsPreview } from '@/composables/dashboard/useDashboard'
import { useScreenSize } from '@/utils/composables'
import { downloadAnalytics, timeFrameWindow } from '@/utils/dashboard/export'
import type {
	AnalyticsFormat,
	AnalyticsKind,
	AnalyticsTimeFrame,
	AnalyticsWindow,
} from '@/types'

const DATE_DEBOUNCE_MS = 350

const props = defineProps<{
	kind: AnalyticsKind
	name: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { isMobile } = useScreenSize()
const [DefineOptions, ReuseOptions] = createReusableTemplate()
const [DefinePreview, ReusePreview] = createReusableTemplate()

const description = computed(() =>
	__(
		'Covers the students who enrolled in this time frame, with their progress as of today.'
	)
)

const formatLabelId = useId()
const format = ref<AnalyticsFormat>('xlsx')
const timeFrame = ref<AnalyticsTimeFrame>('all')
const fromDate = ref<string>('')
const toDate = ref<string>('')
const exporting = ref<boolean>(false)

const formatOptions = computed(() => [
	{ value: 'xlsx', label: __('Excel') },
	{ value: 'pdf', label: __('PDF') },
	{ value: 'png', label: __('Image') },
])

const timeFrameOptions = computed(() => [
	{ value: 'all', label: __('All time') },
	{ value: '7d', label: __('Last 7 days') },
	{ value: '30d', label: __('Last 30 days') },
	{ value: '90d', label: __('Last 90 days') },
	{ value: 'custom', label: __('Custom range') },
])

const rangeError = computed<string>(() =>
	fromDate.value && toDate.value && toDate.value < fromDate.value
		? __('Pick a date on or after the from date.')
		: ''
)

const validRange = computed<boolean>(
	() =>
		timeFrame.value !== 'custom' ||
		Boolean(fromDate.value && toDate.value && !rangeError.value)
)

const chosenWindow = computed<AnalyticsWindow>(() =>
	timeFrameWindow(timeFrame.value, {
		from_date: fromDate.value || null,
		to_date: toDate.value || null,
	})
)

const { preview, loading, error, failure, load, cancel } = useAnalyticsPreview(
	() => props.kind,
	() => props.name,
	format,
	() => (validRange.value ? chosenWindow.value : null)
)

// An export of no students is a report of zeroes: nothing to download.
const canExport = computed<boolean>(
	() => validRange.value && preview.value?.students !== 0
)

watch(
	open,
	(isOpen) => {
		if (isOpen) {
			load()
			return
		}
		cancel()
		format.value = 'xlsx'
		timeFrame.value = 'all'
		fromDate.value = ''
		toDate.value = ''
	},
	{ immediate: true }
)

watch([format, timeFrame], () => {
	if (open.value) load()
})

watch([fromDate, toDate], () => {
	if (open.value) load(DATE_DEBOUNCE_MS)
})

async function runExport(): Promise<void> {
	if (!canExport.value || exporting.value) return
	exporting.value = true
	try {
		await downloadAnalytics(
			props.kind,
			props.name,
			format.value,
			chosenWindow.value
		)
		open.value = false
	} catch (error) {
		toast.error(__('Could not export analytics'), {
			description: error instanceof Error ? error.message : String(error),
		})
	} finally {
		exporting.value = false
	}
}
</script>
