<template>
	<div :class="SIDEBAR_ROW" data-testid="flow-step">
		<button
			type="button"
			class="grid h-full shrink-0 place-items-center rounded-4 ps-2 focus-visible:ring-0 focus-visible:focus-ring disabled:cursor-not-allowed"
			:class="status === 'done' ? 'text-ink-green-7' : 'text-ink-gray-6'"
			:disabled="Boolean(parent)"
			:aria-pressed="status === 'done'"
			:aria-label="toggleLabel"
			data-testid="step-toggle"
			@click.stop="toggleStep(flow.id, step.name)"
		>
			<LucideCircleCheck
				v-if="status === 'done'"
				:class="SIDEBAR_ICON"
				aria-hidden="true"
			/>
			<component
				:is="step.icon"
				v-else
				:class="[SIDEBAR_ICON, { 'opacity-50': parent }]"
				aria-hidden="true"
			/>
		</button>
		<component
			:is="parent ? Tooltip : 'div'"
			:text="blockedText"
			class="flex h-full min-w-0 flex-1"
		>
			<span
				v-if="status === 'skipped'"
				class="ms-2 flex h-full min-w-0 flex-1 items-center"
			>
				<span
					class="truncate"
					:class="[ROW_TEXT, titleClass]"
					data-testid="step-open"
				>
					{{ step.title }}
				</span>
			</span>
			<button
				v-else
				type="button"
				class="ms-2 text-start"
				:class="SIDEBAR_ROW_CONTROL"
				:aria-disabled="isResolved || Boolean(parent)"
				@click="startStep(flow.id, step.name)"
			>
				<span
					class="truncate"
					:class="[ROW_TEXT, titleClass]"
					data-testid="step-open"
				>
					{{ step.title }}
				</span>
			</button>
		</component>
		<div class="flex shrink-0 items-center gap-1">
			<Button
				v-if="isResolved || !parent"
				variant="ghost"
				size="sm"
				class="!text-ink-gray-6 invisible group-hover/sidebar-item:visible group-focus-within/sidebar-item:visible"
				@click.stop="skipOrReset"
			>
				<span :class="ROW_TEXT">{{ isResolved ? text.reset : text.skip }}</span>
			</Button>
			<Dropdown
				v-if="step.chooses && !isResolved"
				:options="choiceOptions"
				data-testid="step-choice"
			>
				<Button
					variant="ghost"
					size="sm"
					:class="actionClass"
					:disabled="Boolean(parent)"
					data-testid="step-action"
				>
					<span :class="ROW_TEXT">{{ step.actionLabel }}</span>
				</Button>
			</Dropdown>
			<Button
				v-else-if="!isResolved"
				variant="ghost"
				size="sm"
				:class="actionClass"
				:disabled="Boolean(parent)"
				data-testid="step-action"
				@click.stop="startStep(flow.id, step.name)"
			>
				<span :class="ROW_TEXT">{{ step.actionLabel }}</span>
			</Button>
			<Badge
				v-if="status === 'skipped'"
				theme="gray"
				variant="subtle"
				size="sm"
				:label="text.skipped"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Dropdown, Tooltip } from 'frappe-ui'
import type { FlowCard, FlowStep, OnboardingFlow } from '@/onboarding/types'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'
import {
	ROW_TEXT,
	SIDEBAR_ICON,
	SIDEBAR_ROW,
	SIDEBAR_ROW_CONTROL,
} from '@/onboarding/rowClasses'

const props = defineProps<{
	card: FlowCard
	flow: OnboardingFlow
	step: FlowStep
}>()

const {
	stepStatus,
	blocker,
	nextStep,
	toggleStep,
	skipStep,
	undoStep,
	startStep,
	answer,
} = useLearningOnboarding()

const text = {
	skipped: __('Skipped'),
	skip: __('Skip'),
	reset: __('Reset'),
}

const status = computed(() => stepStatus(props.flow.id, props.step))
const parent = computed(() => blocker(props.flow.id, props.step))
const isResolved = computed<boolean>(
	() => status.value === 'done' || status.value === 'skipped'
)

const actionClass = computed<string>(() =>
	nextStep(props.flow.id)?.name === props.step.name
		? '!text-ink-gray-9'
		: '!text-ink-gray-6'
)

const titleClass = computed<string>(() => {
	if (isResolved.value) return 'text-ink-gray-6 line-through'
	if (parent.value) return 'cursor-default text-ink-gray-4'
	return 'text-ink-gray-8'
})

const blockedText = computed<string>(() =>
	parent.value
		? __('You need to complete "{0}" first.').format(parent.value.title ?? '')
		: ''
)

function skipOrReset(): void {
	if (isResolved.value) undoStep(props.flow.id, props.step.name)
	else skipStep(props.flow.id, props.step.name)
}

const toggleLabel = computed<string>(() =>
	status.value === 'done'
		? __('Mark {0} as not done').format(props.step.title ?? '')
		: __('Mark {0} as done').format(props.step.title ?? '')
)

// The card's answers, offered on the step that asks the question. Picking one
// answers the card, which ticks the step and opens that answer's flow.
const choiceOptions = computed(() =>
	(props.card.question?.options ?? []).map((option) => ({
		label: option.label,
		description: option.description,
		onClick: () => answer(props.card.id, option.value),
	}))
)
</script>
