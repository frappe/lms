<template>
	<section
		class="fixed z-50 end-0 w-80 h-[calc(100%_-_80px)] text-ink-gray-9 m-5 mt-[62px] p-3 flex gap-2 flex-col justify-between rounded-6 bg-surface-elevation-2 shadow-2xl"
		:class="{ 'top-[calc(100%_-_120px)] border': minimize }"
		:aria-labelledby="headingId"
		data-testid="onboarding-flow-panel"
		@click.stop
	>
		<div class="flex h-12 shrink-0 items-center justify-between gap-1 px-1">
			<div class="flex min-w-0 items-center gap-1">
				<Button
					v-if="screen !== 'list'"
					variant="ghost"
					:aria-label="text.allFlows"
					@click="showList"
				>
					<LucideChevronLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
				</Button>
				<h2 :id="headingId" class="truncate px-1 text-base font-medium">
					{{ text.heading }}
				</h2>
			</div>
			<div class="flex gap-1">
				<Button
					variant="ghost"
					:aria-label="minimize ? text.expand : text.minimize"
					@click="minimize = !minimize"
				>
					<component
						:is="minimize ? MaximizeIcon : MinimizeIcon"
						class="h-3.5"
						aria-hidden="true"
					/>
				</Button>
				<Button variant="ghost" :aria-label="text.close" @click="closePanel">
					<LucideX class="size-3.5" aria-hidden="true" />
				</Button>
			</div>
		</div>

		<div class="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
			<OnboardingChecklist
				v-if="screen === 'flow' && openCard && openFlow"
				:key="openFlow.key"
				:card="openCard"
				:flow="openFlow"
			/>

			<template v-else-if="screen === 'question' && openCard?.question">
				<h3
					class="truncate px-2 text-base font-medium"
					data-testid="question-title"
				>
					{{ openCard.question.title }}
				</h3>
				<div class="flex flex-col gap-0.5">
					<Tooltip
						v-for="option in openCard.question.options"
						:key="option.value"
						:text="option.description"
					>
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-6 px-2 py-2 text-start transition-colors hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2"
							data-testid="question-option"
							@click="answer(openCard.id, option.value)"
						>
							<span class="min-w-0 flex-1 truncate text-p-sm font-medium">
								{{ option.label }}
							</span>
							<span class="shrink-0 text-p-xs tabular-nums text-ink-gray-5">
								{{ stepCount(option.flow.id) }}
							</span>
							<LucideChevronRight
								class="size-4 shrink-0 text-ink-gray-4 rtl:rotate-180"
								aria-hidden="true"
							/>
						</button>
					</Tooltip>
				</div>
			</template>

			<template v-else>
				<div
					class="flex items-center justify-between gap-2 px-2"
					data-testid="list-heading"
				>
					<h3 class="truncate text-base font-medium">{{ listHeading }}</h3>
					<span
						v-if="listState !== 'fresh'"
						class="shrink-0 text-p-xs tabular-nums text-ink-gray-5"
					>
						{{ completedCards }}/{{ CARDS.length }}
					</span>
				</div>
				<div class="flex flex-col gap-0.5">
					<Tooltip
						v-for="card in CARDS"
						:key="card.id"
						:text="card.description"
					>
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-6 px-2 py-2 text-start transition-colors hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2"
							data-testid="flow-row"
							@click="openCardScreen(card.id)"
						>
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-5"
								:class="
									isCardComplete(card)
										? 'bg-surface-green-2 text-ink-green-7'
										: 'bg-surface-gray-2 text-ink-gray-7'
								"
								aria-hidden="true"
							>
								<LucideCheck v-if="isCardComplete(card)" class="size-4" />
								<component :is="card.icon" v-else class="size-4" />
							</span>
							<span class="min-w-0 flex-1 truncate text-p-sm font-medium">
								{{ card.title }}
							</span>
							<span class="shrink-0 text-p-xs tabular-nums text-ink-gray-5">
								{{ rowMeta(card) }}
							</span>
							<LucideChevronRight
								class="size-4 shrink-0 text-ink-gray-4 rtl:rotate-180"
								aria-hidden="true"
							/>
						</button>
					</Tooltip>
				</div>
			</template>
		</div>

		<div class="flex shrink-0 items-center justify-between gap-2">
			<Button
				variant="ghost"
				href="https://docs.frappe.io/learning"
				:label="text.helpCentre"
			>
				<template #prefix>
					<HelpIcon class="h-4" aria-hidden="true" />
				</template>
			</Button>
			<Button
				v-if="screen === 'list' && hasAnyProgress"
				variant="ghost"
				:label="text.resetAll"
				@click="resetEverything"
			/>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { Button, Tooltip } from 'frappe-ui'
import { HelpIcon, MaximizeIcon, MinimizeIcon } from 'frappe-ui/icons'
import { minimize } from '@framework/ui/components/Onboarding/index'
import OnboardingChecklist from '@/components/Onboarding/OnboardingChecklist.vue'
import { CARDS, type FlowCard, type FlowId } from '@/onboarding/flows'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'

const {
	screen,
	openCard,
	openFlow,
	listState,
	completedCards,
	hasAnyProgress,
	stepsOf,
	cardProgress,
	isCardComplete,
	openCardScreen,
	answer,
	showList,
	closePanel,
	resetEverything,
} = useLearningOnboarding()

const headingId = useId()

const text = {
	heading: __('Getting started'),
	allFlows: __('All flows'),
	expand: __('Expand'),
	minimize: __('Minimize'),
	close: __('Close'),
	helpCentre: __('Help centre'),
	resetAll: __('Reset all'),
}

const listHeading = computed<string>(() => {
	if (listState.value === 'done') return __('You’re all set')
	if (listState.value === 'progress') return __('Pick up where you left off')
	return __('What do you want to do first?')
})

function rowMeta(card: FlowCard): string {
	const progress = cardProgress(card)
	return progress ? `${progress.resolved}/${progress.total}` : ''
}

function stepCount(id: FlowId): string {
	return __('{0} steps').format(String(stepsOf(id).length))
}
</script>
