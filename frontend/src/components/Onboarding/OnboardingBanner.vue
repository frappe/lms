<template>
	<div
		v-if="!isSidebarCollapsed"
		class="flex flex-col gap-3 shadow-sm rounded-6 py-2.5 px-3 bg-surface-elevation-2 text-p-sm"
	>
		<div v-if="!allDone" class="inline-flex text-ink-gray-9 gap-2">
			<StepsIcon class="h-4 my-0.5 shrink-0" aria-hidden="true" />
			<div class="flex flex-col gap-0.5">
				<div class="text-p-sm font-medium" data-testid="banner-title">
					{{ text.title }}
				</div>
				<div class="text-p-sm text-ink-gray-7" data-testid="banner-count">
					{{ countLabel }}
				</div>
			</div>
		</div>
		<div v-else class="flex flex-col gap-1">
			<div class="flex items-center justify-between gap-1">
				<div class="flex items-center gap-2 shrink-0">
					<StepsIcon class="h-4 my-0.5" aria-hidden="true" />
					<div class="text-p-sm text-ink-gray-9 font-medium">
						{{ text.allSet }}
					</div>
				</div>
				<button
					type="button"
					class="rounded-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-4"
					:aria-label="text.dismiss"
					@click="isOnboardingStepsCompleted = true"
				>
					<LucideX class="size-4" aria-hidden="true" />
				</button>
			</div>
			<div class="text-p-sm text-ink-gray-7">{{ text.allDone }}</div>
		</div>
		<Button
			v-if="!allDone"
			:label="stepsCompleted === 0 ? text.start : text.continue"
			theme="blue"
			@click="openOnboarding"
		>
			<template #prefix>
				<LucideChevronsRight class="size-4 rtl:rotate-180" aria-hidden="true" />
			</template>
		</Button>
	</div>
	<Button v-else-if="!allDone" :aria-label="text.title" @click="openOnboarding">
		<StepsIcon class="h-4 my-0.5 shrink-0" aria-hidden="true" />
	</Button>
</template>

<script setup lang="ts">
// A copy of the framework's Onboarding/GettingStartedBanner.vue, at the LMS
// text size (text-p-sm), with the dismiss control as a real button.
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import { StepsIcon } from 'frappe-ui/icons'
import {
	minimize,
	showHelpModal,
	useOnboarding,
} from '@framework/ui/components/Onboarding/index'

const props = withDefaults(
	defineProps<{ appName: string; isSidebarCollapsed?: boolean }>(),
	{ isSidebarCollapsed: false }
)

// AppSidebar renders this only for a signed-in System Manager whose flows are
// set up, so the handle is never undefined here.
const { stepsCompleted, totalSteps, isOnboardingStepsCompleted } =
	useOnboarding(props.appName)!

const text = {
	title: __('Getting started'),
	allSet: __('You are all set'),
	allDone: __('All steps are completed successfully'),
	dismiss: __('Dismiss'),
	start: __('Start now'),
	continue: __('Continue'),
}

const allDone = computed<boolean>(
	() => stepsCompleted.value === totalSteps.value
)

const countLabel = computed<string>(() =>
	__('{0}/{1} steps').format(
		String(stepsCompleted.value),
		String(totalSteps.value)
	)
)

function openOnboarding(): void {
	minimize.value = false
	showHelpModal.value = true
}
</script>
