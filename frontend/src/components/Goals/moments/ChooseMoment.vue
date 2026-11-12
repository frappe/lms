<template>
	<div>
		<p class="mb-3 text-p-base text-ink-gray-9">{{ moment.prompt }}</p>
		<!-- Full-width rows: options read as sentences, and the why sits under each. -->
		<div class="flex flex-col gap-2">
			<button
				v-for="(option, i) in moment.options"
				:key="i"
				type="button"
				:disabled="!!result"
				class="flex items-start gap-3 rounded-5 border px-3 py-2.5 text-start transition-colors"
				:class="cardClass(i)"
				:aria-pressed="!result && picked === i"
				@click="pick(i)"
			>
				<span
					v-if="!result"
					class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-2 text-p-xs"
					:class="
						picked === i
							? 'bg-surface-gray-7 text-ink-base'
							: 'border border-outline-gray-2 text-ink-gray-6'
					"
					aria-hidden="true"
					>{{ i + 1 }}</span
				>
				<span
					v-else
					class="mt-0.5 size-4 shrink-0"
					:class="optionIcon(i)"
					aria-hidden="true"
				/>
				<span class="min-w-0 flex-1">
					<span class="block text-p-sm text-ink-gray-9">{{
						optionText(option)
					}}</span>
					<span
						v-if="result && (option.correct || result.picked === i)"
						class="mt-1 block text-p-xs text-ink-gray-7"
					>
						{{ option.why }}
					</span>
				</span>
				<Badge
					v-if="result && (option.correct || result.picked === i)"
					size="sm"
					class="shrink-0"
					:theme="option.correct ? 'green' : 'amber'"
					:label="option.correct ? __('Best choice') : __('Your pick')"
				/>
			</button>
		</div>
		<div v-if="!result" class="mt-3 flex items-center justify-between gap-3">
			<span class="text-p-xs text-ink-gray-6">{{
				active && moment.options.length <= 9
					? __('Press 1 to {0}, then Enter to check', [moment.options.length])
					: __('Pick one, then check')
			}}</span>
			<Button
				variant="solid"
				size="sm"
				:disabled="picked === null"
				:label="__('Check')"
				@click="check"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { Badge, Button } from 'frappe-ui'
import { useMomentKeys } from '@/composables/useMomentKeys'

const props = defineProps<{
	moment: Record<string, any>
	result?: Record<string, any> | null
	active?: boolean
}>()

// The model occasionally drifts off schema and sends options as bare strings;
// showing the text still beats blank cards.
const optionText = (option: unknown): string =>
	typeof option === 'string'
		? option
		: (option as { text?: string })?.text || ''
const emit = defineEmits<{ answer: [result: Record<string, unknown>] }>()

// Picking only marks an option; Check sends it, so a slip of the finger is not an answer.
const picked = ref<number | null>(null)
const pick = (i: number) => {
	if (!props.result) picked.value = i
}
const check = () => {
	if (props.result || picked.value === null) return
	const i = picked.value
	const option = props.moment.options[i]
	emit('answer', {
		correct: Boolean(option.correct),
		picked: i,
		summary: {
			their_choice: option.text,
			better_choice: optionText(
				props.moment.options.find((o: { correct?: boolean }) => o?.correct)
			),
		},
	})
}

const cardClass = (i: number) => {
	const option = props.moment.options[i]
	if (!props.result)
		return picked.value === i
			? 'border-outline-gray-5 bg-surface-gray-1'
			: 'border-outline-gray-2 bg-surface-base hover:border-outline-gray-4 hover:bg-surface-gray-1'
	if (option.correct) return 'border-outline-green-2 bg-surface-green-1'
	if (props.result.picked === i)
		return 'border-outline-amber-2 bg-surface-amber-1'
	return 'border-outline-gray-1 bg-surface-base opacity-60'
}

const optionIcon = (i: number) => {
	const option = props.moment.options[i]
	if (!props.result) return 'lucide-circle text-ink-gray-6'
	if (option.correct) return 'lucide-circle-check text-ink-green-6'
	if (props.result.picked === i) return 'lucide-circle-x text-ink-amber-6'
	return 'lucide-circle text-ink-gray-4'
}

useMomentKeys(
	toRef(props, 'active'),
	() => (props.result ? 0 : props.moment.options.length),
	pick,
	check
)
</script>
