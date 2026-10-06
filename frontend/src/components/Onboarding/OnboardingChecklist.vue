<template>
	<div class="flex min-h-0 flex-col gap-2.5">
		<OnboardingProgressHeader
			:percent="percent"
			:canReset="percent !== 0"
			@reset="resetFlow(flow.id)"
			@skip="skipRemaining(flow.id)"
		/>

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
			<OnboardingStepRow
				v-for="step in steps"
				:key="step.name"
				:card="card"
				:flow="flow"
				:step="step"
			/>
		</div>

		<template v-if="complete">
			<div v-if="next" class="flex flex-col gap-0.5 pt-3">
				<span class="px-2 text-ink-gray-5" :class="ROW_TEXT">
					{{ text.tryNext }}
				</span>
				<Tooltip :text="next.description">
					<div>
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
					</div>
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
import { Button, Dropdown, SidebarItem, Tooltip } from 'frappe-ui'
import OnboardingProgressHeader from '@/components/Onboarding/OnboardingProgressHeader.vue'
import OnboardingStepRow from '@/components/Onboarding/OnboardingStepRow.vue'
import type { FlowCard, FlowStep, OnboardingFlow } from '@/onboarding/flows'
import { percentOf } from '@/onboarding/onboardingProgress'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'
import { ROW_TEXT, SIDEBAR_ICON } from '@/onboarding/rowClasses'

const props = defineProps<{ card: FlowCard; flow: OnboardingFlow }>()

const {
	stepsOf,
	flowProgress,
	isFlowComplete,
	answerOf,
	nextCard,
	cardProgress,
	skipRemaining,
	resetFlow,
	answer,
	openCardScreen,
} = useLearningOnboarding()

const text = {
	continue: __('Continue'),
	tryIt: __('Try it'),
	tryNext: __('Try next'),
	allDone: __('All flows complete'),
}

const steps = computed<FlowStep[]>(() => stepsOf(props.flow.id))
const complete = computed<boolean>(() => isFlowComplete(props.flow.id))
const percent = computed<number>(() => percentOf(flowProgress(props.flow.id)))

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

function openNextCard(): void {
	if (next.value) openCardScreen(next.value.id)
}
</script>
