<template>
	<div>
		<p class="mb-3 text-p-sm text-ink-gray-7">{{ moment.prompt }}</p>
		<div class="space-y-1.5">
			<button
				v-for="(slot, i) in moment.slots"
				:key="i"
				type="button"
				:disabled="!!result || !filled[i]"
				class="flex w-full items-center gap-3 rounded-5 border px-3 py-2 text-start text-p-sm"
				:class="slotClass(i)"
				:aria-label="
					filled[i]
						? __('Remove {0} from {1}').format(filled[i], slot.label)
						: slot.label
				"
				@click="filled[i] = null"
			>
				<span class="flex-1 text-p-sm text-ink-gray-7">{{ slot.label }}</span>
				<span class="flex w-32 shrink-0 flex-col items-end text-end sm:w-48">
					<span v-if="filled[i]" class="font-medium text-ink-gray-9">{{
						filled[i]
					}}</span>
					<span v-else class="text-ink-gray-6">{{
						__('Tap a piece below')
					}}</span>
					<span
						v-if="result && filled[i] !== slot.answer"
						class="text-p-xs text-ink-gray-7"
					>
						{{ __('Answer: {0}').format(slot.answer) }}
					</span>
				</span>
			</button>
		</div>
		<div v-if="!result" class="mt-3 flex flex-wrap gap-2">
			<Button
				v-for="piece in pieces"
				:key="piece"
				size="sm"
				:disabled="filled.includes(piece)"
				@click="place(piece)"
			>
				{{ piece }}
			</Button>
		</div>
		<div v-if="!result" class="mt-3 flex justify-end">
			<Button
				variant="solid"
				size="sm"
				:disabled="filled.some((piece) => !piece)"
				@click="check"
			>
				{{ __('Check') }}
			</Button>
		</div>
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

const slots: { label: string; answer: string }[] = props.moment.slots || []
const pieces = [
	...slots.map((slot) => slot.answer),
	...(props.moment.extra_pieces || []),
].sort(() => Math.random() - 0.5)
const filled = ref<(string | null)[]>(
	props.result?.filled || slots.map(() => null)
)

const place = (piece: string) => {
	const empty = filled.value.indexOf(null)
	if (empty !== -1) filled.value[empty] = piece
}

const check = () => {
	const wrong = slots
		.map((slot, i) => ({
			slot: slot.label,
			theirs: filled.value[i],
			right: slot.answer,
		}))
		.filter((row) => row.theirs !== row.right)
	emit('answer', {
		correct: !wrong.length,
		filled: filled.value,
		summary: { wrong },
	})
}

const slotClass = (i: number) => {
	if (!props.result)
		return filled.value[i]
			? 'border-outline-gray-3 bg-surface-gray-1'
			: 'border-dashed border-outline-gray-3 bg-surface-base'
	return filled.value[i] === slots[i].answer
		? 'border-outline-green-2 bg-surface-green-1'
		: 'border-outline-amber-2 bg-surface-amber-1'
}
</script>
