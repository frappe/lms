<template>
	<div
		data-slot="stepper"
		:data-orientation="vertical ? 'vertical' : 'horizontal'"
		:data-size="size"
		:data-edge="vertical ? edge : undefined"
		:data-loading="loading || undefined"
	>
		<StepperHorizontal
			:steps="resolved"
			:size="size"
			:loading="loading"
			:clickable="clickable && !completed"
			@select="select"
		>
			<template v-if="$slots['step-prefix']" #step-prefix="slotProps">
				<slot name="step-prefix" v-bind="slotProps" />
			</template>
			<template v-if="$slots['step-label']" #step-label="slotProps">
				<slot name="step-label" v-bind="slotProps" />
			</template>
			<template v-if="$slots['step-description']" #step-description="slotProps">
				<slot name="step-description" v-bind="slotProps" />
			</template>
			<template v-if="$slots['step-suffix']" #step-suffix="slotProps">
				<slot name="step-suffix" v-bind="slotProps" />
			</template>
		</StepperHorizontal>
	</div>
</template>

<script setup lang="ts">
// Mirror of frappe-ui experimental/Stepper (frappe/frappe-ui#1304), unreleased as of 1.0.2. Replace with import { Stepper } from 'frappe-ui/experimental' once LMS pins a release that ships it; vertical layout is not mirrored. Text uses ink-gray-6 where upstream has ink-gray-5 (fails AA in rc.1; a11y-contrast test).
import { computed } from 'vue'
import type { VNode } from 'vue'
import StepperHorizontal from './StepperHorizontal.vue'
import { resolveSteps } from './resolve'
import type {
	StepSlotProps,
	StepValue,
	StepperEmits,
	StepperProps,
} from './types'

const props = withDefaults(defineProps<StepperProps>(), {
	modelValue: null,
	completed: false,
	loading: false,
	failed: false,
	vertical: false,
	edge: 'start',
	size: 'md',
	substeps: 'all',
	clickable: false,
})

const emit = defineEmits<StepperEmits>()

defineSlots<{
	/** Replaces a step's indicator. */
	'step-prefix'?: (props: StepSlotProps) => VNode[]
	/** Replaces a step's label. */
	'step-label'?: (props: StepSlotProps) => VNode[]
	/** Replaces a step's description (vertical only). */
	'step-description'?: (props: StepSlotProps) => VNode[]
	/** Replaces a step's trailing meta text (vertical only). */
	'step-suffix'?: (props: StepSlotProps) => VNode[]
}>()

const resolved = computed(() =>
	resolveSteps(props.steps, {
		current: props.modelValue,
		completed: props.completed,
		failed: props.failed,
	})
)

function select(value: StepValue) {
	if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>
