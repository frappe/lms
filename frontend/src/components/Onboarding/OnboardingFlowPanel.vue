<template>
	<section
		class="fixed z-50 end-0 w-80 h-[calc(100%_-_80px)] text-ink-gray-9 m-5 mt-[62px] p-3 flex gap-2 flex-col justify-between rounded-6 bg-surface-elevation-2 shadow-2xl"
		:class="{ 'top-[calc(100%_-_120px)] border': minimize }"
		:aria-labelledby="headingId"
		data-testid="onboarding-flow-panel"
		@click.stop
	>
		<div class="flex items-center justify-between gap-1 px-2 py-1.5">
			<div class="flex min-w-0 items-center gap-1">
				<Button
					v-if="panelView === 'checklist'"
					variant="ghost"
					class="-ms-2"
					data-testid="all-flows"
					:label="text.allFlows"
					@click="showAllFlows"
				>
					<template #prefix>
						<LucideChevronLeft
							class="size-4 rtl:rotate-180"
							aria-hidden="true"
						/>
					</template>
				</Button>
				<h2
					:id="headingId"
					class="truncate text-base font-medium"
					:class="{ 'sr-only': panelView === 'checklist' }"
				>
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

		<div class="h-full overflow-y-auto flex flex-col gap-4">
			<OnboardingChecklist
				v-if="panelView === 'checklist' && activeFlow"
				:key="activeFlow.key"
				:flow="activeFlow"
			/>

			<template v-else-if="panelView === 'done' && activeFlow">
				<div class="flex flex-col items-center gap-1 mt-4 px-2 text-center">
					<span
						class="flex size-10 items-center justify-center rounded-full bg-surface-green-2 text-ink-green-7 mb-3"
						aria-hidden="true"
					>
						<LucideCheck class="size-5" />
					</span>
					<h3 class="text-base font-medium" data-testid="flow-done-title">
						{{ activeFlow.doneTitle }}
					</h3>
					<p class="text-p-sm text-ink-gray-6">
						{{ remainingCards.length ? text.pickNext : text.allDone }}
					</p>
					<Button
						variant="solid"
						class="mt-3"
						:label="activeFlow.doneAction.label"
						@click="runDoneAction"
					/>
				</div>
				<ul
					v-if="remainingCards.length"
					class="flex flex-col gap-0.5"
					:aria-label="text.nextFlows"
				>
					<li
						v-for="card in remainingCards"
						:key="card.id"
						class="flex items-center gap-3 rounded-6 px-2 py-2.5"
						data-testid="remaining-flow"
					>
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-5 bg-surface-gray-2 text-ink-gray-7"
							aria-hidden="true"
						>
							<component :is="card.icon" class="size-4" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-p-sm font-medium text-ink-gray-9">
								{{ card.title }}
							</span>
							<span class="block text-p-xs text-ink-gray-5">
								{{ card.description }}
							</span>
						</span>
						<Button
							:label="text.start"
							:aria-label="startLabel(card.title)"
							@click="chooseCard(card.id)"
						/>
					</li>
				</ul>
			</template>

			<template v-else-if="panelView === 'provider'">
				<div class="flex flex-col gap-3">
					<Button
						variant="ghost"
						class="self-start"
						data-testid="provider-back"
						:label="text.back"
						@click="cancelProvider"
					>
						<template #prefix>
							<LucideChevronLeft
								class="size-4 rtl:rotate-180"
								aria-hidden="true"
							/>
						</template>
					</Button>
					<div class="flex flex-col gap-1 px-2">
						<h3 class="text-base font-medium">{{ text.providerTitle }}</h3>
						<p class="text-p-sm text-ink-gray-6">{{ text.providerHint }}</p>
					</div>
				</div>
				<div class="flex flex-col gap-0.5">
					<button
						v-for="flow in providerFlows"
						:key="flow.id"
						type="button"
						class="group flex items-center gap-3 rounded-6 px-2 py-2.5 text-start transition-colors hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2"
						data-testid="provider-flow"
						@click="setFlow(flow.id)"
					>
						<span class="min-w-0 flex-1">
							<span class="block text-p-sm font-medium text-ink-gray-9">
								{{ flow.provider?.label }}
							</span>
							<span class="block text-p-xs text-ink-gray-5">
								{{ flow.provider?.description }}
							</span>
						</span>
						<LucideChevronRight
							class="size-4 shrink-0 text-ink-gray-4 rtl:rotate-180"
							aria-hidden="true"
						/>
					</button>
				</div>
			</template>

			<template v-else>
				<div class="flex flex-col items-center gap-1 mt-4 px-2 text-center">
					<LMSLogo class="size-10 shrink-0 rounded-4 mb-3" aria-hidden="true" />
					<h3 class="text-base font-medium">
						{{ text.pickerTitle }}
					</h3>
					<p class="text-p-sm text-ink-gray-6">
						{{ remainingCards.length ? text.pickerHint : text.allDone }}
					</p>
				</div>
				<button
					v-if="resumableFlow"
					type="button"
					class="flex items-center gap-3 rounded-6 border border-outline-gray-2 px-2 py-2.5 text-start transition-colors hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2"
					data-testid="continue-flow"
					@click="continueFlow"
				>
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-5 bg-surface-gray-2 text-ink-gray-7"
						aria-hidden="true"
					>
						<component :is="resumableFlow.icon" class="size-4" />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block text-p-sm font-medium text-ink-gray-9">
							{{ continueLabel(resumableFlow.title) }}
						</span>
						<span class="block text-p-xs text-ink-gray-5">
							{{ stepCount(flowProgress(resumableFlow.id)) }}
						</span>
					</span>
					<LucideChevronRight
						class="size-4 shrink-0 text-ink-gray-4 rtl:rotate-180"
						aria-hidden="true"
					/>
				</button>
				<div class="flex flex-col gap-0.5">
					<button
						v-for="card in pickerCards"
						:key="card.id"
						type="button"
						class="group flex items-center gap-3 rounded-6 px-2 py-2.5 text-start transition-colors hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2"
						data-testid="picker-flow"
						@click="chooseCard(card.id)"
					>
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-5 bg-surface-gray-2 text-ink-gray-7 transition-colors group-hover:bg-surface-base"
							aria-hidden="true"
						>
							<component :is="card.icon" class="size-4" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-p-sm font-medium text-ink-gray-9">
								{{ card.title }}
							</span>
							<span class="block text-p-xs text-ink-gray-5">
								{{ card.description }}
							</span>
						</span>
						<Badge
							v-if="isCardComplete(card.id)"
							theme="green"
							:label="text.done"
						/>
						<span
							v-else-if="cardProgress(card)"
							class="shrink-0 text-p-xs text-ink-gray-5"
						>
							{{ stepCount(cardProgress(card)!) }}
						</span>
						<LucideChevronRight
							class="size-4 shrink-0 text-ink-gray-4 rtl:rotate-180"
							aria-hidden="true"
						/>
					</button>
				</div>
			</template>
		</div>

		<div class="flex flex-col gap-1.5">
			<Button
				v-if="panelView === 'done' && !allCardsComplete"
				variant="ghost"
				:label="text.skipAll"
				@click="skipAllFlows"
			/>
			<Button
				v-else-if="panelView === 'done'"
				variant="ghost"
				:label="text.restart"
				@click="restartOnboarding"
			/>
			<a
				href="https://docs.frappe.io/learning"
				v-external
				class="w-full flex gap-2 items-center hover:bg-surface-gray-1 text-ink-gray-8 rounded-4 px-2 py-1.5"
			>
				<HelpIcon class="h-4" aria-hidden="true" />
				<span class="text-base">{{ text.helpCentre }}</span>
			</a>
		</div>
	</section>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { Badge, Button } from 'frappe-ui'
import { HelpIcon, MaximizeIcon, MinimizeIcon } from 'frappe-ui/icons'
import { minimize } from '@framework/ui/components/Onboarding/index'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import OnboardingChecklist from '@/components/Onboarding/OnboardingChecklist.vue'
import type { Progress } from '@/onboarding/useLearningOnboarding'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'

const {
	activeFlow,
	resumableFlow,
	remainingCards,
	pickerCards,
	providerFlows,
	panelView,
	setFlow,
	chooseCard,
	cancelProvider,
	closePanel,
	skipAllFlows,
	restartOnboarding,
	allCardsComplete,
	runDoneAction,
	showAllFlows,
	continueFlow,
	flowProgress,
	cardProgress,
	isCardComplete,
} = useLearningOnboarding()

const headingId = useId()

const text = {
	heading: __('Getting started'),
	expand: __('Expand'),
	minimize: __('Minimize'),
	close: __('Close'),
	pickNext: __('Pick what to set up next.'),
	allDone: __('You have finished every getting started flow.'),
	nextFlows: __('Next flows'),
	start: __('Start'),
	pickerTitle: __('What do you want to do first?'),
	pickerHint: __('Pick a goal and follow its checklist.'),
	skipAll: __('Skip all'),
	restart: __('Restart onboarding'),
	back: __('Back'),
	allFlows: __('All flows'),
	done: __('Done'),
	providerTitle: __('Which meeting tool do you use?'),
	providerHint: __('The checklist depends on your choice.'),
	helpCentre: __('Help centre'),
}

function continueLabel(title: string): string {
	return __('Continue: {0}').format(title)
}

function stepCount(progress: Progress): string {
	return __('{0}/{1} steps').format(
		String(progress.completed),
		String(progress.total)
	)
}

function startLabel(title: string): string {
	return __('Start {0}').format(title)
}
</script>
