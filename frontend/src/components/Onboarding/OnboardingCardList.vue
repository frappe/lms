<template>
	<div class="flex min-h-0 flex-col gap-2.5">
		<OnboardingProgressHeader
			:percent="overallPercent"
			:canReset="hasAnyProgress"
			@reset="resetEverything"
			@skip="skipEverything"
		/>
		<div class="flex flex-col gap-1.5 overflow-y-auto">
			<Tooltip v-for="card in CARDS" :key="card.id" :text="card.description">
				<div>
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
								class="truncate text-p-sm"
								:class="
									isCardComplete(card)
										? 'text-ink-gray-6 line-through'
										: 'text-ink-gray-8'
								"
								data-testid="row-title"
							>
								{{ card.title }}
							</span>
							<span
								class="flex shrink-0 items-center gap-1 text-p-sm text-ink-gray-6"
							>
								<span class="tabular-nums">{{ rowMeta(card) }}</span>
								<LucideChevronRight
									class="size-4 rtl:rotate-180"
									aria-hidden="true"
								/>
							</span>
						</span>
					</SidebarItem>
				</div>
			</Tooltip>
		</div>
	</div>
</template>

<script setup lang="ts">
import { SidebarItem, Tooltip } from 'frappe-ui'
import OnboardingProgressHeader from '@/components/Onboarding/OnboardingProgressHeader.vue'
import { CARDS } from '@/onboarding/cards'
import type { FlowCard } from '@/onboarding/types'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'

const {
	overallPercent,
	hasAnyProgress,
	cardProgress,
	isCardComplete,
	openCardScreen,
	resetEverything,
	skipEverything,
} = useLearningOnboarding()

function rowMeta(card: FlowCard): string {
	const progress = cardProgress(card)
	return progress ? `${progress.resolved}/${progress.total}` : ''
}
</script>
