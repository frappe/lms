<template>
	<div>
		<p class="mb-3 text-p-base text-ink-gray-9">{{ moment.question }}</p>
		<div class="space-y-1.5" role="radiogroup" :aria-label="moment.question">
			<button
				v-for="(option, i) in moment.options"
				:key="i"
				type="button"
				role="radio"
				:aria-checked="picked === i"
				:disabled="!!result"
				class="flex w-full items-center gap-2.5 rounded-5 border px-3 py-2 text-start text-p-sm transition-colors"
				:class="optionClass(i)"
				@click="picked = i"
			>
				<span class="size-4 shrink-0" :class="optionIcon(i)" />
				<span class="text-ink-gray-8">{{ optionText(option) }}</span>
			</button>
		</div>
		<template v-if="!result">
			<div class="mt-4 text-p-xs text-ink-gray-6">
				{{ __('How sure are you?') }}
			</div>
			<div class="mt-1.5 flex flex-wrap gap-2">
				<Button
					v-for="level in levels"
					:key="level.value"
					size="sm"
					:variant="confidence === level.value ? 'solid' : 'subtle'"
					@click="confidence = level.value"
				>
					{{ level.label }}
				</Button>
			</div>
			<div class="mt-3 flex justify-end">
				<Button
					variant="solid"
					size="sm"
					:disabled="picked === null || !confidence"
					@click="check"
				>
					{{ __('Place my bet') }}
				</Button>
			</div>
		</template>
		<p v-else class="mt-3 text-p-sm text-ink-gray-7">{{ verdict }}</p>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from 'frappe-ui'

const props = defineProps<{
	moment: Record<string, any>
	result?: Record<string, any> | null
}>()
const emit = defineEmits<{ answer: [result: Record<string, unknown>] }>()

const levels = [
	{ label: __('Just guessing'), value: 'guessing' },
	{ label: __('Fairly sure'), value: 'fairly sure' },
	{ label: __('Certain'), value: 'certain' },
]
const picked = ref<number | null>(props.result?.picked ?? null)
const confidence = ref<string | null>(props.result?.confidence ?? null)

// The model occasionally drifts off schema and sends options as bare strings;
// showing the text still beats six blank rows.
const optionText = (option: unknown): string =>
	typeof option === 'string'
		? option
		: (option as { text?: string })?.text || ''

const correctIndex = computed(() =>
	(props.moment.options || []).findIndex(
		(o: { correct?: boolean }) => o?.correct
	)
)

const verdict = computed(() => {
	if (!props.result) return ''
	if (props.result.correct)
		return props.result.confidence === 'guessing'
			? __('Right, and now you know why. Trust it next time.')
			: __('Right, and you knew it.')
	return props.result.confidence === 'certain'
		? __('Confidently wrong: the most useful thing to catch now.')
		: __('Not this time. Your tutor will clear it up.')
})

const check = () => {
	const correct = picked.value === correctIndex.value
	emit('answer', {
		correct,
		picked: picked.value,
		confidence: confidence.value,
		summary: {
			their_answer: optionText(props.moment.options[picked.value as number]),
			right_answer: optionText(props.moment.options[correctIndex.value]),
			confidence: confidence.value,
		},
	})
}

const optionClass = (i: number) => {
	if (!props.result)
		return picked.value === i
			? 'border-outline-gray-4 bg-surface-gray-2'
			: 'border-outline-gray-1 bg-surface-base hover:border-outline-gray-3'
	if (i === correctIndex.value)
		return 'border-outline-green-2 bg-surface-green-1'
	if (i === picked.value) return 'border-outline-amber-2 bg-surface-amber-1'
	return 'border-outline-gray-1 bg-surface-base opacity-60'
}

const optionIcon = (i: number) => {
	if (!props.result)
		return picked.value === i
			? 'lucide-circle-dot text-ink-gray-8'
			: 'lucide-circle text-ink-gray-6'
	if (i === correctIndex.value) return 'lucide-circle-check text-ink-green-6'
	if (i === picked.value) return 'lucide-circle-x text-ink-amber-6'
	return 'lucide-circle text-ink-gray-6'
}
</script>
