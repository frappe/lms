<template>
	<section
		class="fixed z-50 end-0 w-80 h-[calc(100%_-_80px)] text-ink-gray-9 m-5 mt-[62px] p-3 flex gap-2 flex-col justify-between rounded-6 bg-surface-elevation-2 shadow-2xl"
		:class="{ 'top-[calc(100%_-_120px)] border': minimize }"
		:aria-labelledby="headingId"
		data-testid="onboarding-flow-panel"
		@click.stop
	>
		<div class="flex items-center justify-between px-2 py-1.5">
			<h2 :id="headingId" class="text-base font-medium">
				{{ text.heading }}
			</h2>
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
			<template v-if="panelView === 'done' && activeFlow">
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
						{{ remainingFlows.length ? text.pickNext : text.allDone }}
					</p>
					<Button
						variant="solid"
						class="mt-3"
						:label="activeFlow.doneAction.label"
						@click="runDoneAction"
					/>
				</div>
				<ul
					v-if="remainingFlows.length"
					class="flex flex-col gap-0.5"
					:aria-label="text.nextFlows"
				>
					<li
						v-for="flow in remainingFlows"
						:key="flow.id"
						class="flex items-center gap-3 rounded-6 px-2 py-2.5"
						data-testid="remaining-flow"
					>
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-5 bg-surface-gray-2 text-ink-gray-7"
							aria-hidden="true"
						>
							<component :is="flow.icon" class="size-4" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-p-sm font-medium text-ink-gray-9">
								{{ flow.title }}
							</span>
							<span class="block text-p-xs text-ink-gray-5">
								{{ flow.description }}
							</span>
						</span>
						<Button
							:label="text.start"
							:aria-label="startLabel(flow.title)"
							@click="setFlow(flow.id)"
						/>
					</li>
				</ul>
			</template>

			<template v-else>
				<div class="flex flex-col items-center gap-1 mt-4 px-2 text-center">
					<LMSLogo class="size-10 shrink-0 rounded-4 mb-3" aria-hidden="true" />
					<h3 class="text-base font-medium">
						{{ text.pickerTitle }}
					</h3>
					<p class="text-p-sm text-ink-gray-6">
						{{ remainingFlows.length ? text.pickerHint : text.allDone }}
					</p>
				</div>
				<div class="flex flex-col gap-0.5">
					<button
						v-for="flow in remainingFlows"
						:key="flow.id"
						type="button"
						class="group flex items-center gap-3 rounded-6 px-2 py-2.5 text-start transition-colors hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2"
						data-testid="picker-flow"
						@click="setFlow(flow.id)"
					>
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-5 bg-surface-gray-2 text-ink-gray-7 transition-colors group-hover:bg-surface-base"
							aria-hidden="true"
						>
							<component :is="flow.icon" class="size-4" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-p-sm font-medium text-ink-gray-9">
								{{ flow.title }}
							</span>
							<span class="block text-p-xs text-ink-gray-5">
								{{ flow.description }}
							</span>
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
				v-if="panelView === 'done'"
				variant="ghost"
				:label="text.later"
				@click="closePanel"
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
import { Button } from 'frappe-ui'
import { HelpIcon, MaximizeIcon, MinimizeIcon } from 'frappe-ui/icons'
import { minimize } from '@framework/ui/components/Onboarding/index'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'

const {
	activeFlow,
	remainingFlows,
	panelView,
	setFlow,
	closePanel,
	runDoneAction,
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
	later: __('Maybe later'),
	helpCentre: __('Help centre'),
}

function startLabel(title: string): string {
	return __('Start {0}').format(title)
}
</script>
