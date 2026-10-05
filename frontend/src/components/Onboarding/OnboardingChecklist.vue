<template>
	<div class="flex min-h-0 flex-col gap-2.5">
		<div
			class="flex items-center justify-between py-0.5"
			data-testid="badge-row"
		>
			<Badge
				:label="percentLabel"
				:theme="percent === 100 ? 'green' : 'amber'"
				size="lg"
			/>
			<div class="flex">
				<Button
					v-if="percent !== 0"
					variant="ghost"
					:label="text.resetAll"
					@click="resetFlow(flow.id)"
				/>
				<Button
					v-if="percent !== 100"
					variant="ghost"
					:label="text.skipAll"
					@click="skipRemaining(flow.id)"
				/>
			</div>
		</div>

		<Dropdown
			v-if="card.question && currentOption"
			:options="answerOptions"
			data-testid="answer-switch"
		>
			<Button variant="ghost" size="sm" class="self-start">
				<span :class="ROW_TEXT">{{ switchLabel }}</span>
				<template #suffix>
					<LucideChevronDown class="size-4" aria-hidden="true" />
				</template>
			</Button>
		</Dropdown>

		<div class="flex flex-col gap-0.5 overflow-y-auto">
			<div
				v-for="step in steps"
				:key="step.name"
				:class="SIDEBAR_ROW"
				data-testid="flow-step"
			>
				<button
					type="button"
					class="grid h-full shrink-0 place-items-center rounded-4 ps-2 focus-visible:ring-0 focus-visible:focus-ring disabled:cursor-not-allowed"
					:class="
						statusOf(step) === 'done' ? 'text-ink-green-7' : 'text-ink-gray-6'
					"
					:disabled="Boolean(blockerOf(step))"
					:aria-pressed="statusOf(step) === 'done'"
					:aria-label="toggleLabel(step)"
					data-testid="step-toggle"
					@click.stop="toggleStep(flow.id, step.name)"
				>
					<LucideCircleCheck
						v-if="statusOf(step) === 'done'"
						:class="SIDEBAR_ICON"
						aria-hidden="true"
					/>
					<component
						:is="step.icon"
						v-else
						:class="[SIDEBAR_ICON, { 'opacity-50': blockerOf(step) }]"
						aria-hidden="true"
					/>
				</button>
				<component
					:is="blockerOf(step) ? Tooltip : 'div'"
					:text="blockedText(step)"
					class="flex h-full min-w-0 flex-1"
				>
					<button
						type="button"
						class="ms-2 text-start"
						:class="SIDEBAR_ROW_CONTROL"
						:aria-disabled="isResolved(step) || Boolean(blockerOf(step))"
						@click="startStep(flow.id, step.name)"
					>
						<span
							class="truncate"
							:class="[ROW_TEXT, titleClass(step)]"
							data-testid="step-open"
						>
							{{ step.title }}
						</span>
					</button>
				</component>
				<div class="flex shrink-0 items-center gap-1 pe-1">
					<span
						v-if="statusOf(step) === 'skipped'"
						class="text-ink-gray-5"
						:class="ROW_TEXT"
					>
						{{ text.skipped }}
					</span>
					<Button
						v-if="!isResolved(step) && !blockerOf(step)"
						variant="ghost"
						size="sm"
						class="!text-ink-gray-6 invisible group-hover/sidebar-item:visible group-focus-within/sidebar-item:visible"
						@click.stop="skipStep(flow.id, step.name)"
					>
						<span :class="ROW_TEXT">{{ text.skip }}</span>
					</Button>
					<Button
						v-else-if="isResolved(step)"
						variant="ghost"
						size="sm"
						class="!text-ink-gray-6 invisible group-hover/sidebar-item:visible group-focus-within/sidebar-item:visible"
						@click.stop="undoStep(flow.id, step.name)"
					>
						<span :class="ROW_TEXT">{{ text.reset }}</span>
					</Button>
					<Dropdown
						v-if="step.chooses && statusOf(step) !== 'done'"
						:options="choiceOptions"
						data-testid="step-choice"
					>
						<Button
							variant="ghost"
							size="sm"
							:class="isNext(step) ? '!text-ink-gray-9' : '!text-ink-gray-6'"
							:disabled="Boolean(blockerOf(step))"
							data-testid="step-action"
						>
							<span :class="ROW_TEXT">{{ actionLabel(step) }}</span>
						</Button>
					</Dropdown>
					<Button
						v-else-if="statusOf(step) !== 'done'"
						variant="ghost"
						size="sm"
						:class="isNext(step) ? '!text-ink-gray-9' : '!text-ink-gray-6'"
						:disabled="Boolean(blockerOf(step))"
						data-testid="step-action"
						@click.stop="startStep(flow.id, step.name)"
					>
						<span :class="ROW_TEXT">{{ actionLabel(step) }}</span>
					</Button>
				</div>
			</div>
		</div>

		<template v-if="complete">
			<div v-if="next" class="flex flex-col gap-0.5 pt-3">
				<span class="px-2 text-ink-gray-5" :class="ROW_TEXT">
					{{ text.tryNext }}
				</span>
				<Tooltip :text="next.description">
					<SidebarItem
						:label="next.title"
						data-testid="next-up"
						@click="openNextCard"
					>
						<template #prefix>
							<component
								:is="next.icon"
								class="text-ink-gray-6"
								:class="SIDEBAR_ICON"
								aria-hidden="true"
							/>
						</template>
						<span
							class="text-ink-gray-8"
							:class="ROW_TEXT"
							data-testid="next-title"
						>
							{{ next.title }}
						</span>
						<template #suffix>
							<Button
								variant="ghost"
								size="sm"
								class="me-1"
								data-testid="next-action"
								@click="openNextCard"
							>
								<span :class="ROW_TEXT">
									{{ nextStarted ? text.continue : text.tryIt }}
								</span>
							</Button>
						</template>
					</SidebarItem>
				</Tooltip>
			</div>
			<p v-else class="text-center text-ink-gray-5" :class="ROW_TEXT">
				{{ text.allDone }}
			</p>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Dropdown, SidebarItem, Tooltip } from 'frappe-ui'
import type { FlowCard, FlowStep, OnboardingFlow } from '@/onboarding/flows'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'
import {
	ROW_TEXT,
	SIDEBAR_ICON,
	SIDEBAR_ROW,
	SIDEBAR_ROW_CONTROL,
} from '@/onboarding/rowClasses'

const props = defineProps<{ card: FlowCard; flow: OnboardingFlow }>()

const {
	stepsOf,
	stepStatus,
	blocker,
	flowProgress,
	isFlowComplete,
	answerOf,
	nextCard,
	cardProgress,
	toggleStep,
	skipStep,
	undoStep,
	startStep,
	skipRemaining,
	resetFlow,
	answer,
	openCardScreen,
	nextStep,
} = useLearningOnboarding()

const text = {
	resetAll: __('Reset all'),
	skipAll: __('Skip all'),
	skipped: __('Skipped'),
	skip: __('Skip'),
	reset: __('Reset'),
	continue: __('Continue'),
	tryIt: __('Try it'),
	tryNext: __('Try next'),
	doIt: __('Do it'),
	allDone: __('All flows complete'),
}

const steps = computed<FlowStep[]>(() => stepsOf(props.flow.id))
const progress = computed(() => flowProgress(props.flow.id))
const complete = computed<boolean>(() => isFlowComplete(props.flow.id))

const percent = computed<number>(() =>
	progress.value.total
		? Math.floor((progress.value.resolved / progress.value.total) * 100)
		: 0
)

const percentLabel = computed<string>(() =>
	__('{0}% completed').format(String(percent.value))
)

const currentOption = computed(() =>
	props.card.question?.options.find((o) => o.value === answerOf(props.card))
)

const switchLabel = computed<string>(() =>
	__('{0}: {1}').format(
		props.card.question?.label ?? '',
		currentOption.value?.label ?? ''
	)
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

// Labels are read here, at render, so the translation getters always run.
const answerOptions = computed(() =>
	(props.card.question?.options ?? []).map((option) => ({
		label: option.label,
		selected: option.value === currentOption.value?.value,
		onClick: () => answer(props.card.id, option.value),
	}))
)

const next = computed<FlowCard | null>(() =>
	complete.value ? nextCard(props.card) : null
)

const nextStarted = computed<boolean>(() =>
	Boolean(next.value && (cardProgress(next.value)?.resolved ?? 0) > 0)
)

const upcoming = computed<FlowStep | null>(() => nextStep(props.flow.id))

function isNext(step: FlowStep): boolean {
	return upcoming.value?.name === step.name
}

function actionLabel(step: FlowStep): string {
	return statusOf(step) === 'skipped' ? text.doIt : step.actionLabel
}

function openNextCard(): void {
	if (next.value) openCardScreen(next.value.id)
}

function statusOf(step: FlowStep) {
	return stepStatus(props.flow.id, step)
}

function blockerOf(step: FlowStep) {
	return blocker(props.flow.id, step)
}

function isResolved(step: FlowStep): boolean {
	const status = statusOf(step)
	return status === 'done' || status === 'skipped'
}

function titleClass(step: FlowStep): string {
	if (isResolved(step)) return 'text-ink-gray-5 line-through'
	if (blockerOf(step)) return 'cursor-default text-ink-gray-4'
	return 'text-ink-gray-8'
}

function blockedText(step: FlowStep): string {
	const parent = blockerOf(step)
	return parent
		? __('You need to complete "{0}" first.').format(parent.title ?? '')
		: ''
}

function toggleLabel(step: FlowStep): string {
	return statusOf(step) === 'done'
		? __('Mark {0} as not done').format(step.title ?? '')
		: __('Mark {0} as done').format(step.title ?? '')
}
</script>
