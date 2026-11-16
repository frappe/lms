<template>
	<ChartCard class="flex flex-col">
		<div
			ref="root"
			class="relative min-h-0 flex-1 rounded-4 outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
			tabindex="0"
			role="group"
			:aria-label="
				__('Completion by stage. Use the arrow keys, Enter filters.')
			"
			@keydown="onKeydown"
			@blur="onBlur"
		>
			<FunnelChart
				:data="stages"
				category="label"
				value="students"
				class="!gap-4"
				:title="__('Completion')"
				:loading="!funnel"
				:palette="palette"
				@select="selectStage"
			>
				<template #loading>
					<PanelSkeleton />
				</template>
			</FunnelChart>
			<p class="sr-only" aria-live="polite">{{ cursorText }}</p>
		</div>
	</ChartCard>
</template>
<script setup lang="ts">
import { ChartCard, FunnelChart, useChartTokens } from 'frappe-ui/charts'
import type { FunnelStageEvent } from 'frappe-ui/charts'
import { computed, ref } from 'vue'
import {
	BATCH_FUNNEL_STEPS,
	batchFilterForStep,
	batchStepForFilter,
	funnelPalette,
} from '@/utils/dashboard/charts'
import PanelSkeleton from '@/components/Dashboard/PanelSkeleton.vue'
import type { BatchFunnelStep } from '@/utils/dashboard/charts'
import { useStepCursor } from '@/composables/dashboard/useDashboard'
import type { BatchFilter, BatchFunnel } from '@/types'

interface FunnelStage {
	key: BatchFunnelStep
	label: string
	students: number
}

const props = defineProps<{
	funnel: BatchFunnel | null
	activeFilter: BatchFilter | null
}>()

const emit = defineEmits<{
	selectStage: [stage: BatchFilter | null]
}>()

const root = ref<HTMLElement>()
const { tokens } = useChartTokens(root)

const stages = computed<FunnelStage[]>(() => {
	const funnel = props.funnel
	if (!funnel) return []
	const labels: Record<BatchFunnelStep, string> = {
		enrolled: __('Enrolled'),
		started: __('Started'),
		completed: __('Completed all courses'),
		evaluation_requested: __('Evaluation requested'),
		certified: __('Certified'),
	}
	return BATCH_FUNNEL_STEPS.map((key) => ({
		key,
		label: labels[key],
		students: funnel[key],
	}))
})

const { cursor, onKeydown, onBlur } = useStepCursor(
	computed(() => stages.value.length),
	(index) => emit('selectStage', batchFilterForStep(stages.value[index]!.key))
)

// The step under the keyboard cursor lights up the way an applied one does.
const palette = computed<string[] | undefined>(() =>
	funnelPalette(
		BATCH_FUNNEL_STEPS,
		cursor.value === null
			? batchStepForFilter(props.activeFilter)
			: stages.value[cursor.value]!.key,
		tokens.value
	)
)

const cursorText = computed<string>(() => {
	const stage = cursor.value === null ? null : stages.value[cursor.value]
	return stage
		? __('{0}: {1} students').format(
				stage.label,
				stage.students.toLocaleString()
		  )
		: ''
})

const selectStage = (event: FunnelStageEvent): void => {
	emit('selectStage', batchFilterForStep((event.row as FunnelStage).key))
}
</script>
