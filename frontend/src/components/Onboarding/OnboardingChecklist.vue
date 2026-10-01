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

		<div
			v-if="completedStep"
			class="flex items-center justify-between gap-2 rounded-4 px-2 py-1.5"
			data-testid="step-done"
		>
			<div class="flex min-w-0 items-center gap-2">
				<LucideCircleCheck
					class="size-4 shrink-0 text-ink-green-7"
					aria-hidden="true"
				/>
				<span class="truncate text-base text-ink-gray-8">
					{{ doneLabel(completedStep) }}
				</span>
			</div>
			<Button
				v-if="upcoming"
				variant="ghost"
				size="sm"
				class="min-w-0 max-w-[60%] shrink"
				@click="runUpcoming"
			>
				<span class="block truncate">{{ nextLabel(upcoming) }}</span>
			</Button>
			<Button
				v-else-if="next"
				variant="ghost"
				size="sm"
				:label="nextStarted ? text.continue : text.tryIt"
				@click="openNextCard"
			/>
		</div>

		<Dropdown
			v-if="card.question && currentOption"
			:options="answerOptions"
			data-testid="answer-switch"
		>
			<Button variant="ghost" size="sm" class="self-start">
				{{ switchLabel }}
				<template #suffix>
					<LucideChevronDown class="size-3.5" aria-hidden="true" />
				</template>
			</Button>
		</Dropdown>

		<div class="flex flex-col gap-1.5 overflow-y-auto">
			<div
				v-for="step in steps"
				:key="step.name"
				class="group flex w-full items-center justify-between gap-2 rounded-4 px-2 py-1.5 hover:bg-surface-gray-1"
				data-testid="flow-step"
			>
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<button
						type="button"
						class="flex size-5 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-4 disabled:cursor-not-allowed"
						:class="
							statusOf(step) === 'done' ? 'text-ink-green-7' : 'text-ink-gray-7'
						"
						:disabled="Boolean(blockerOf(step))"
						:aria-pressed="statusOf(step) === 'done'"
						:aria-label="toggleLabel(step)"
						data-testid="step-toggle"
						@click.stop="toggleStep(flow.id, step.name)"
					>
						<LucideCircleCheck
							v-if="statusOf(step) === 'done'"
							class="size-4"
							aria-hidden="true"
						/>
						<component
							:is="step.icon"
							v-else
							class="h-4"
							:class="{ 'opacity-50': blockerOf(step) }"
							aria-hidden="true"
						/>
					</button>
					<component
						:is="blockerOf(step) ? Tooltip : 'div'"
						:text="blockedText(step)"
						class="min-w-0 flex-1"
					>
						<button
							type="button"
							class="block w-full truncate rounded-4 text-start text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-4"
							:class="titleClass(step)"
							:aria-disabled="isResolved(step) || Boolean(blockerOf(step))"
							data-testid="step-open"
							@click="startStep(flow.id, step.name)"
						>
							{{ step.title }}
						</button>
					</component>
					<span
						v-if="statusOf(step) === 'skipped'"
						class="shrink-0 text-p-xs text-ink-gray-5"
					>
						{{ text.skipped }}
					</span>
				</div>
				<div class="flex shrink-0 items-center gap-1">
					<Button
						v-if="!isResolved(step) && !blockerOf(step)"
						:label="text.skip"
						class="!h-4 text-xs !text-ink-gray-6 invisible group-hover:visible group-focus-within:visible"
						@click.stop="skipStep(flow.id, step.name)"
					/>
					<Button
						v-else-if="isResolved(step)"
						:label="text.reset"
						class="!h-4 text-xs !text-ink-gray-6 invisible group-hover:visible group-focus-within:visible"
						@click.stop="undoStep(flow.id, step.name)"
					/>
					<Button
						v-if="statusOf(step) !== 'done'"
						variant="ghost"
						size="sm"
						:class="isNext(step) ? '!text-ink-gray-9' : '!text-ink-gray-6'"
						:disabled="Boolean(blockerOf(step))"
						:label="actionLabel(step)"
						data-testid="step-action"
						@click.stop="startStep(flow.id, step.name)"
					/>
				</div>
			</div>
		</div>

		<template v-if="complete">
			<div v-if="next" class="flex flex-col gap-1 pt-3">
				<span class="px-2 text-p-xs text-ink-gray-5">{{ text.tryNext }}</span>
				<Tooltip :text="next.description">
					<div
						class="flex w-full items-center justify-between gap-2 rounded-4 px-2 py-1.5"
						data-testid="next-up"
					>
						<div class="flex min-w-0 items-center gap-2 text-ink-gray-8">
							<component
								:is="next.icon"
								class="h-4 shrink-0"
								aria-hidden="true"
							/>
							<span class="text-base" data-testid="next-title">
								{{ next.title }}
							</span>
						</div>
						<Button
							variant="ghost"
							size="sm"
							:label="nextStarted ? text.continue : text.tryIt"
							@click="openNextCard"
						/>
					</div>
				</Tooltip>
			</div>
			<p v-else class="text-center text-p-sm text-ink-gray-5">
				{{ text.allDone }}
			</p>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Dropdown, Tooltip } from 'frappe-ui'
import type { FlowCard, FlowStep, OnboardingFlow } from '@/onboarding/flows'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'

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
	justCompleted,
	dismissCompleted,
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

/** The step a form, fact or tick just completed in this flow, if any. */
const completedStep = computed<FlowStep | null>(() => {
	const last = justCompleted.value
	if (!last || last.flow !== props.flow.id) return null
	return steps.value.find((step) => step.name === last.step) ?? null
})

const upcoming = computed<FlowStep | null>(() => nextStep(props.flow.id))

function isNext(step: FlowStep): boolean {
	return upcoming.value?.name === step.name
}

function actionLabel(step: FlowStep): string {
	return statusOf(step) === 'skipped' ? text.doIt : step.actionLabel
}

function doneLabel(step: FlowStep): string {
	return __('{0} done').format(step.title ?? '')
}

function nextLabel(step: FlowStep): string {
	return __('Next: {0}').format(step.title ?? '')
}

function runUpcoming(): void {
	const step = upcoming.value
	dismissCompleted()
	if (step) startStep(props.flow.id, step.name)
}

function openNextCard(): void {
	dismissCompleted()
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
