<template>
	<div>
		<p class="text-p-sm text-ink-gray-7">{{ moment.prompt }}</p>
		<p class="mt-2 rounded-5 bg-surface-gray-1 p-3 text-p-base text-ink-gray-9">
			{{ moment.situation }}
		</p>
		<div class="relative mt-5 px-1">
			<!-- Styled by hand: the framework's input reset strips a native range bare,
			     which left no track or thumb to see. -->
			<input
				v-model.number="value"
				type="range"
				min="0"
				max="100"
				:disabled="!!result"
				class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-gray-3 disabled:cursor-default [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-outline-gray-3 [&::-moz-range-thumb]:bg-surface-gray-7 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-outline-gray-3 [&::-webkit-slider-thumb]:bg-surface-gray-7"
				:aria-label="moment.prompt"
			/>
			<span
				v-if="result"
				class="absolute -top-4 -translate-x-1/2 text-p-xs text-ink-green-7"
				:style="{ insetInlineStart: `${moment.answer}%` }"
			>
				▼ {{ __('policy') }}
			</span>
		</div>
		<div class="mt-1 flex justify-between text-p-xs text-ink-gray-6">
			<span>{{ moment.low_label }}</span>
			<span>{{ moment.high_label }}</span>
		</div>
		<div v-if="!result" class="mt-3 flex justify-end">
			<Button variant="solid" size="sm" @click="check">{{
				__('Lock it in')
			}}</Button>
		</div>
		<p v-else class="mt-3 text-p-sm text-ink-gray-7">
			{{
				result.correct
					? __('Spot on, you read it the way the policy does.')
					: __('The marker shows where the material puts it.')
			}}
		</p>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from 'frappe-ui'

const props = defineProps<{
	moment: Record<string, any>
	result?: Record<string, any> | null
}>()
const emit = defineEmits<{ answer: [result: Record<string, unknown>] }>()

const value = ref<number>(props.result?.value ?? 50)

const check = () => {
	const gap = Math.abs(value.value - Number(props.moment.answer))
	emit('answer', {
		correct: gap <= 20,
		value: value.value,
		summary: {
			their_rating: value.value,
			material_rating: props.moment.answer,
			scale: `${props.moment.low_label} (0) to ${props.moment.high_label} (100)`,
		},
	})
}
</script>
