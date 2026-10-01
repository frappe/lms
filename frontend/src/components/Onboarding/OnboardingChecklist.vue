<template>
	<div class="flex flex-col gap-3">
		<div class="flex items-center gap-2" data-testid="flow-header">
			<span
				class="flex size-9 shrink-0 items-center justify-center rounded-5"
				:class="
					complete
						? 'bg-surface-green-2 text-ink-green-7'
						: 'bg-surface-gray-2 text-ink-gray-7'
				"
				aria-hidden="true"
			>
				<LucideCheck v-if="complete" class="size-4" />
				<component :is="card.icon" v-else class="size-4" />
			</span>
			<h3 class="min-w-0 flex-1 truncate text-base font-semibold">
				{{ card.title }}
			</h3>
			<span class="shrink-0 text-p-xs tabular-nums text-ink-gray-5">
				{{ meta }}
			</span>
			<Dropdown :options="menu" data-testid="flow-menu">
				<Button
					variant="ghost"
					icon="lucide-ellipsis"
					:aria-label="text.menu"
				/>
			</Dropdown>
		</div>

		<Progress :value="percent" size="sm" />

		<div
			v-if="card.question && currentOption"
			class="flex items-center justify-between gap-2 rounded-6 border border-outline-gray-2 bg-surface-gray-1 ps-2"
			data-testid="answer-chip"
		>
			<span class="truncate text-p-xs text-ink-gray-5">
				{{ card.question.label }}
			</span>
			<Dropdown :options="answerOptions">
				<Button variant="ghost" :label="currentOption.label">
					<template #suffix>
						<LucideChevronDown class="size-3.5" aria-hidden="true" />
					</template>
				</Button>
			</Dropdown>
		</div>

		<ul class="flex flex-col gap-0.5">
			<li
				v-for="step in steps"
				:key="step.name"
				class="group flex h-9 items-center gap-2 rounded-4 px-2 hover:bg-surface-gray-1"
				:data-status="statusOf(step)"
				data-testid="flow-step"
			>
				<button
					type="button"
					class="flex size-4.5 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-4 disabled:cursor-not-allowed disabled:opacity-50"
					:class="circleClass(step)"
					:disabled="Boolean(blockerOf(step))"
					:aria-pressed="statusOf(step) === 'done'"
					:aria-label="toggleLabel(step)"
					data-testid="step-toggle"
					@click.stop="toggleStep(flow.id, step.name)"
				>
					<LucideCheck
						v-if="statusOf(step) === 'done'"
						class="size-3"
						aria-hidden="true"
					/>
					<LucideMinus
						v-else-if="statusOf(step) === 'skipped'"
						class="size-3"
						aria-hidden="true"
					/>
				</button>
				<component
					:is="blockerOf(step) ? Tooltip : 'div'"
					:text="blockedText(step)"
					class="min-w-0 flex-1"
				>
					<span
						class="block truncate text-base"
						:class="
							isStrong(step) ? 'font-medium text-ink-gray-9' : 'text-ink-gray-5'
						"
					>
						{{ step.title }}
					</span>
				</component>
				<Badge
					v-if="statusOf(step) === 'skipped'"
					:label="text.skipped"
					class="group-hover:hidden group-focus-within:hidden"
				/>
				<template v-if="statusOf(step) === 'current'">
					<Button
						variant="ghost"
						:label="text.skip"
						class="hidden group-hover:flex group-focus-within:flex"
						@click="skipStep(flow.id, step.name)"
					/>
					<Button
						variant="subtle"
						:label="text.start"
						@click="startStep(flow.id, step.name)"
					/>
				</template>
				<Button
					v-else-if="isResolved(step)"
					variant="ghost"
					:label="text.undo"
					class="hidden group-hover:flex group-focus-within:flex"
					@click="undoStep(flow.id, step.name)"
				/>
			</li>
		</ul>

		<div
			v-if="complete"
			class="flex flex-col gap-2 border-t border-outline-gray-2 pt-3"
		>
			<template v-if="next">
				<span class="text-p-xs text-ink-gray-5">{{ text.nextUp }}</span>
				<div
					class="flex flex-col gap-2 rounded-6 border border-outline-gray-2 bg-surface-gray-1 p-2"
					data-testid="next-up"
				>
					<Tooltip :text="next.description">
						<div class="flex items-center gap-2">
							<span
								class="flex size-7 shrink-0 items-center justify-center rounded-5 bg-surface-gray-2 text-ink-gray-7"
								aria-hidden="true"
							>
								<component :is="next.icon" class="size-4" />
							</span>
							<span class="min-w-0 truncate text-p-sm font-medium">
								{{ next.title }}
							</span>
						</div>
					</Tooltip>
					<Button
						variant="solid"
						class="w-full"
						:label="nextStarted ? text.continue : text.start"
						@click="openCardScreen(next.id)"
					/>
				</div>
			</template>
			<template v-else>
				<span class="text-base font-medium">{{ text.allDone }}</span>
				<span class="text-p-sm text-ink-gray-5">{{ text.revisit }}</span>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Dropdown, Progress, Tooltip } from 'frappe-ui'
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
} = useLearningOnboarding()

const text = {
	menu: __('Flow actions'),
	skipRemaining: __('Skip remaining'),
	resetFlow: __('Reset this flow'),
	skipped: __('Skipped'),
	skip: __('Skip'),
	start: __('Start'),
	undo: __('Undo'),
	continue: __('Continue'),
	nextUp: __('Next up'),
	allDone: __('All flows complete'),
	revisit: __('You can revisit any flow from the list.'),
}

const steps = computed<FlowStep[]>(() => stepsOf(props.flow.id))
const progress = computed(() => flowProgress(props.flow.id))
const complete = computed<boolean>(() => isFlowComplete(props.flow.id))

const percent = computed<number>(() =>
	progress.value.total
		? Math.round((progress.value.resolved / progress.value.total) * 100)
		: 0
)

const meta = computed<string>(() => {
	const parts = [`${progress.value.resolved}/${progress.value.total}`]
	if (progress.value.skipped)
		parts.push(__('{0} skipped').format(String(progress.value.skipped)))
	if (complete.value) parts.push(__('Complete'))
	return parts.join(' · ')
})

const menu = computed(() => [
	...(complete.value
		? []
		: [
				{
					label: text.skipRemaining,
					onClick: () => skipRemaining(props.flow.id),
				},
		  ]),
	{ label: text.resetFlow, onClick: () => resetFlow(props.flow.id) },
])

const currentOption = computed(() =>
	props.card.question?.options.find((o) => o.value === answerOf(props.card))
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

function isStrong(step: FlowStep): boolean {
	const status = statusOf(step)
	return status === 'done' || status === 'current'
}

function circleClass(step: FlowStep): string {
	switch (statusOf(step)) {
		case 'done':
			return 'bg-surface-green-2 text-ink-green-7'
		case 'skipped':
			return 'border border-outline-gray-3 text-ink-gray-5'
		case 'current':
			return 'border-2 border-outline-gray-5'
		default:
			return 'border border-outline-gray-3'
	}
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
