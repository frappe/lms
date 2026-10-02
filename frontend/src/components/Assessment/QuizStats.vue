<template>
	<dl
		class="grid grid-cols-2 gap-px overflow-hidden rounded-6 border border-outline-gray-2 bg-surface-gray-3 sm:grid-cols-4"
	>
		<div class="space-y-0.5 bg-surface-base px-3 py-2">
			<dt class="text-xs text-ink-gray-6">{{ __('Questions') }}</dt>
			<dd class="text-base font-medium text-ink-gray-9">
				{{ questions }}
			</dd>
		</div>
		<div class="space-y-0.5 bg-surface-base px-3 py-2">
			<dt class="text-xs text-ink-gray-6">{{ __('Time limit') }}</dt>
			<dd class="text-base font-medium text-ink-gray-9">
				{{ duration ? `${duration} ${__('min')}` : __('None') }}
			</dd>
		</div>
		<div class="space-y-0.5 bg-surface-base px-3 py-2">
			<dt class="text-xs text-ink-gray-6">{{ __('Pass mark') }}</dt>
			<dd class="text-base font-medium text-ink-gray-9">
				{{ passingPercentage || 0 }}%
			</dd>
		</div>
		<div class="space-y-0.5 bg-surface-base px-3 py-2">
			<dt class="text-xs text-ink-gray-6">{{ __('Attempts') }}</dt>
			<dd class="text-base font-medium text-ink-gray-9">
				{{ attemptsValue }}
			</dd>
		</div>
	</dl>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// The learner card counts down attempts left; the editor preview has no
// learner, so it shows the quiz's configured maximum instead.
const props = defineProps<{
	questions: number
	duration?: number
	passingPercentage?: number
	attemptsLeft?: number | null
	maxAttempts?: number | null
}>()

const attemptsValue = computed(() => {
	if (props.maxAttempts) return String(props.maxAttempts)
	if (props.attemptsLeft != null) {
		return __('{0} left').format(props.attemptsLeft)
	}
	return __('Unlimited')
})
</script>
