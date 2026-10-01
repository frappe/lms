<template>
	<div class="flex flex-col items-center gap-1 mt-4 mb-6 px-2 text-center">
		<LMSLogo class="size-10 shrink-0 rounded-4 mb-3" aria-hidden="true" />
		<h3 class="text-base font-medium">{{ flow.title }}</h3>
		<p class="text-p-base text-ink-gray-7">{{ stepsLabel }}</p>
	</div>
	<div class="flex min-h-0 flex-col gap-2.5">
		<div class="flex items-center justify-between py-0.5">
			<Badge
				:label="percentLabel"
				:theme="completedPercentage === 100 ? 'green' : 'amber'"
				size="lg"
			/>
			<div class="flex">
				<Button
					v-if="completedPercentage !== 0"
					variant="ghost"
					:label="text.resetAll"
					@click="resetAll(afterResetAll)"
				/>
				<Button
					v-if="completedPercentage !== 100"
					variant="ghost"
					:label="text.skipAll"
					@click="skipAll(afterSkipAll)"
				/>
			</div>
		</div>
		<ul class="flex flex-col gap-1.5 overflow-y-auto">
			<li
				v-for="step in steps"
				:key="step.name"
				class="group flex items-center gap-2 rounded-4 px-2 py-1.5 hover:bg-surface-gray-1"
				data-testid="checklist-step"
			>
				<button
					type="button"
					class="flex size-6 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-4 disabled:cursor-not-allowed"
					:class="
						step.completed
							? 'bg-surface-green-2 text-ink-green-7'
							: 'border border-outline-gray-3 text-ink-gray-7 hover:border-outline-gray-5'
					"
					:disabled="isBlocked(step)"
					:aria-pressed="step.completed"
					:aria-label="toggleLabel(step)"
					data-testid="step-toggle"
					@click.stop="toggle(step)"
				>
					<LucideCircleCheck
						v-if="step.completed"
						class="size-4"
						aria-hidden="true"
					/>
					<component
						:is="step.icon"
						v-else
						class="size-3.5"
						:class="{ 'opacity-50': isBlocked(step) }"
						aria-hidden="true"
					/>
				</button>
				<component
					:is="isBlocked(step) ? Tooltip : 'div'"
					:text="blockedText(step)"
					class="min-w-0 flex-1"
				>
					<button
						type="button"
						class="w-full truncate rounded-4 text-start text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-4"
						:class="
							step.completed
								? 'text-ink-gray-5 line-through'
								: isBlocked(step)
								? 'cursor-default text-ink-gray-4'
								: 'text-ink-gray-8'
						"
						:aria-disabled="step.completed || isBlocked(step)"
						data-testid="step-open"
						@click="open(step)"
					>
						{{ step.title }}
					</button>
				</component>
				<Button
					v-if="!step.completed && !isBlocked(step)"
					:label="text.skip"
					class="!h-4 text-xs !text-ink-gray-6 hidden group-hover:flex group-focus-within:flex"
					@click.stop="skip(step.name, afterSkip)"
				/>
				<Button
					v-else-if="step.completed"
					:label="text.reset"
					class="!h-4 text-xs !text-ink-gray-6 hidden group-hover:flex group-focus-within:flex"
					@click.stop="reset(step.name, afterReset)"
				/>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Tooltip } from 'frappe-ui'
import {
	useOnboarding,
	type OnboardingStep,
} from '@framework/ui/components/Onboarding/index'
import { useTelemetry } from '@framework/ui/telemetry/index'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import type { OnboardingFlow } from '@/onboarding/flows'

const props = defineProps<{ flow: OnboardingFlow }>()

// The panel renders this only after the sidebar set the flows up for a
// signed-in System Manager, so the handle is never undefined here.
const {
	steps,
	stepsCompleted,
	totalSteps,
	completedPercentage,
	updateOnboardingStep,
	skip,
	skipAll,
	reset,
	resetAll,
} = useOnboarding(props.flow.key)!

const { capture } = useTelemetry()

const text = {
	resetAll: __('Reset all'),
	skipAll: __('Skip all'),
	skip: __('Skip'),
	reset: __('Reset'),
}

const stepsLabel = computed(() =>
	__('{0}/{1} steps completed').format(
		String(stepsCompleted.value),
		String(totalSteps.value)
	)
)

const percentLabel = computed(() =>
	__('{0}% completed').format(String(completedPercentage.value))
)

function dependency(step: OnboardingStep): OnboardingStep | undefined {
	if (!step.dependsOn || step.completed) return undefined
	const parent = steps?.find((s) => s.name === step.dependsOn)
	return parent && !parent.completed ? parent : undefined
}

function isBlocked(step: OnboardingStep): boolean {
	return Boolean(dependency(step))
}

function blockedText(step: OnboardingStep): string {
	const parent = dependency(step)
	return parent
		? __('You need to complete "{0}" first.').format(parent.title ?? '')
		: ''
}

function toggleLabel(step: OnboardingStep): string {
	return step.completed
		? __('Mark {0} as not done').format(step.title ?? '')
		: __('Mark {0} as done').format(step.title ?? '')
}

function toggle(step: OnboardingStep): void {
	if (isBlocked(step)) return
	if (step.completed) reset(step.name, afterReset)
	else updateOnboardingStep(step.name, true)
}

function open(step: OnboardingStep): void {
	if (step.completed || isBlocked(step)) return
	step.onClick?.()
}

function afterSkip(step: string): void {
	capture('onboarding_step_skipped_' + step)
}

function afterSkipAll(): void {
	capture('onboarding_steps_skipped')
}

function afterReset(step: string): void {
	capture('onboarding_step_reset_' + step)
}

function afterResetAll(): void {
	capture('onboarding_steps_reset')
}
</script>
