<template>
	<section
		class="fixed z-50 end-0 w-80 h-[calc(100%_-_80px)] text-ink-gray-9 m-5 mt-[62px] p-3 flex gap-2 flex-col justify-between rounded-6 bg-surface-elevation-2 shadow-2xl"
		:class="{ 'top-[calc(100%_-_120px)] border': minimize }"
		:aria-labelledby="headingId"
		data-testid="onboarding-flow-panel"
		@click.stop
	>
		<div class="flex items-center justify-between px-2 py-1.5">
			<div class="flex min-w-0 items-center gap-1">
				<Button
					v-if="screen !== 'list' && screen !== 'help'"
					variant="ghost"
					class="-ms-2"
					:aria-label="text.allFlows"
					@click="showList"
				>
					<LucideChevronLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
				</Button>
				<h2 :id="headingId" class="truncate text-p-base font-medium">
					{{ screen === 'help' ? text.helpHeading : text.heading }}
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
						class="size-4"
						aria-hidden="true"
					/>
				</Button>
				<Button variant="ghost" :aria-label="text.close" @click="closePanel">
					<LucideX class="size-4" aria-hidden="true" />
				</Button>
			</div>
		</div>

		<div class="h-full overflow-hidden flex flex-col">
			<OnboardingHelpCenter
				v-if="screen === 'help'"
				v-model="articles"
				:docsLink="HELP_DOCS_LINK"
			/>
			<template v-else>
				<div class="flex flex-col justify-center items-center gap-1 mt-4 mb-7">
					<LMSLogo class="size-10 shrink-0 rounded-4 mb-4" aria-hidden="true" />
					<div class="text-p-base font-medium" data-testid="hero-title">
						{{ heroTitle }}
					</div>
					<div
						class="text-p-base font-normal text-center"
						data-testid="hero-count"
					>
						{{ heroCount }}
					</div>
				</div>

				<OnboardingChecklist
					v-if="screen === 'flow' && openCard && openFlow"
					:key="openFlow.key"
					:card="openCard"
					:flow="openFlow"
				/>

				<div
					v-else-if="screen === 'question' && openCard?.question"
					class="flex flex-col gap-1.5 overflow-y-auto"
				>
					<Tooltip
						v-for="option in openCard.question.options"
						:key="option.value"
						:text="option.description"
					>
						<SidebarItem
							:label="option.label"
							data-testid="question-option"
							@click="answer(openCard.id, option.value)"
						>
							<template #prefix>
								<component
									:is="openCard.icon"
									class="size-4 text-ink-gray-6"
									aria-hidden="true"
								/>
							</template>
							<span
								class="flex min-w-0 flex-1 items-center justify-between gap-2 pe-2"
							>
								<span class="truncate text-p-base text-ink-gray-8">
									{{ option.label }}
								</span>
								<span
									class="flex shrink-0 items-center gap-1 text-p-base text-ink-gray-5"
								>
									<span class="tabular-nums">{{
										stepCount(option.flow.id)
									}}</span>
									<LucideChevronRight
										class="size-4 rtl:rotate-180"
										aria-hidden="true"
									/>
								</span>
							</span>
						</SidebarItem>
					</Tooltip>
				</div>

				<div v-else class="flex min-h-0 flex-col gap-2.5">
					<div class="flex items-center justify-between py-0.5">
						<Badge
							:label="percentLabel"
							:theme="overallPercent === 100 ? 'green' : 'amber'"
							size="lg"
						/>
						<div class="flex">
							<Button
								v-if="hasAnyProgress"
								variant="ghost"
								:label="text.resetAll"
								@click="resetEverything"
							/>
							<Button
								v-if="overallPercent !== 100"
								variant="ghost"
								:label="text.skipAll"
								@click="skipEverything"
							/>
						</div>
					</div>
					<div class="flex flex-col gap-1.5 overflow-y-auto">
						<Tooltip
							v-for="card in CARDS"
							:key="card.id"
							:text="card.description"
						>
							<SidebarItem
								:label="card.title"
								data-testid="flow-row"
								@click="openCardScreen(card.id)"
							>
								<template #prefix>
									<LucideCircleCheck
										v-if="isCardComplete(card)"
										class="size-4 text-ink-green-7"
										aria-hidden="true"
									/>
									<component
										:is="card.icon"
										v-else
										class="size-4 text-ink-gray-6"
										aria-hidden="true"
									/>
								</template>
								<span
									class="flex min-w-0 flex-1 items-center justify-between gap-2 pe-2"
								>
									<span
										class="truncate text-p-base"
										:class="
											isCardComplete(card)
												? 'text-ink-gray-5 line-through'
												: 'text-ink-gray-8'
										"
										data-testid="row-title"
									>
										{{ card.title }}
									</span>
									<span
										class="flex shrink-0 items-center gap-1 text-p-base text-ink-gray-5"
									>
										<span class="tabular-nums">{{ rowMeta(card) }}</span>
										<LucideChevronRight
											class="size-4 rtl:rotate-180"
											aria-hidden="true"
										/>
									</span>
								</span>
							</SidebarItem>
						</Tooltip>
					</div>
				</div>
			</template>
		</div>

		<div class="flex flex-col gap-1.5" data-testid="panel-footer">
			<SidebarItem
				:label="screen === 'help' ? text.heading : text.helpCentre"
				data-testid="footer-row"
				@click="screen === 'help' ? hideHelp() : showHelp()"
			>
				<template #prefix>
					<component
						:is="screen === 'help' ? StepsIcon : HelpIcon"
						class="size-4 text-ink-gray-6"
						aria-hidden="true"
					/>
				</template>
				<span class="truncate text-p-base text-ink-gray-8">
					{{ screen === 'help' ? text.heading : text.helpCentre }}
				</span>
			</SidebarItem>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Badge, Button, SidebarItem, Tooltip } from 'frappe-ui'
import {
	HelpIcon,
	MaximizeIcon,
	MinimizeIcon,
	StepsIcon,
} from 'frappe-ui/icons'
import { minimize } from '@framework/ui/components/Onboarding/index'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import OnboardingChecklist from '@/components/Onboarding/OnboardingChecklist.vue'
import OnboardingHelpCenter from '@/components/Onboarding/OnboardingHelpCenter.vue'
import { HELP_DOCS_LINK, helpArticles } from '@/onboarding/helpArticles'
import { CARDS, type FlowCard, type FlowId } from '@/onboarding/flows'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'

const {
	screen,
	openCard,
	openFlow,
	completedCards,
	overallPercent,
	hasAnyProgress,
	stepsOf,
	flowProgress,
	cardProgress,
	isCardComplete,
	openCardScreen,
	answer,
	showList,
	showHelp,
	hideHelp,
	closePanel,
	resetEverything,
	skipEverything,
} = useLearningOnboarding()

const headingId = useId()

const articles = ref(helpArticles())

const text = {
	heading: __('Getting started'),
	allFlows: __('All flows'),
	expand: __('Expand'),
	minimize: __('Minimize'),
	close: __('Close'),
	helpCentre: __('Help centre'),
	helpHeading: __('Help center'),
	resetAll: __('Reset all'),
	skipAll: __('Skip all'),
	welcome: __('Welcome to Frappe Learning'),
}

// The framework OnboardingSteps hero: logo, a title, one count line.
const heroTitle = computed<string>(() =>
	screen.value === 'list' || !openCard.value
		? text.welcome
		: openCard.value.title
)

const heroCount = computed<string>(() => {
	if (screen.value === 'question') return openCard.value?.question?.title ?? ''
	if (screen.value === 'flow' && openFlow.value) {
		const progress = flowProgress(openFlow.value.id)
		return __('{0}/{1} steps completed').format(
			String(progress.resolved),
			String(progress.total)
		)
	}
	return __('{0}/{1} flows completed').format(
		String(completedCards.value),
		String(CARDS.length)
	)
})

const percentLabel = computed<string>(() =>
	__('{0}% completed').format(String(overallPercent.value))
)

function rowMeta(card: FlowCard): string {
	const progress = cardProgress(card)
	return progress ? `${progress.resolved}/${progress.total}` : ''
}

function stepCount(id: FlowId): string {
	return __('{0} steps').format(String(stepsOf(id).length))
}
</script>
