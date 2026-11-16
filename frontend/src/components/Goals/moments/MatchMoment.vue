<template>
	<div>
		<p class="mb-3 text-p-base text-ink-gray-9">{{ moment.prompt }}</p>
		<div class="space-y-1.5">
			<button
				v-for="(pair, i) in pairs"
				:key="i"
				type="button"
				:disabled="!!result"
				class="flex w-full items-center gap-3 rounded-5 border px-3 py-2 text-start text-p-sm transition-colors"
				:class="rowClass(i)"
				:aria-pressed="!result && selected === i"
				:aria-label="
					matched[i]
						? __('{0}: {1}. Tap to change').format(pair.left, matched[i])
						: __('{0}: pick a match').format(pair.left)
				"
				@click="choose(i)"
			>
				<span class="flex-1 text-ink-gray-9">{{ pair.left }}</span>
				<span class="size-3.5 shrink-0 lucide-arrow-right text-ink-gray-5" />
				<span class="flex w-32 shrink-0 flex-col items-end text-end sm:w-48">
					<span v-if="matched[i]" class="font-medium text-ink-gray-9">{{
						matched[i]
					}}</span>
					<span v-else class="text-ink-gray-6">{{
						selected === i ? __('Tap a match below') : __('…')
					}}</span>
					<span
						v-if="result && matched[i] !== pair.right"
						class="text-p-xs text-ink-gray-7"
					>
						{{ __('Answer: {0}').format(pair.right) }}
					</span>
				</span>
			</button>
		</div>
		<div v-if="!result" class="mt-3 flex flex-wrap gap-2">
			<Button
				v-for="(piece, p) in pieces"
				:key="p"
				size="sm"
				:disabled="used.includes(p)"
				@click="place(p)"
			>
				{{ piece }}
			</Button>
		</div>
		<div v-if="!result" class="mt-3 flex items-center justify-between gap-3">
			<span class="text-p-xs text-ink-gray-6">{{
				__('Tap a row, then its match')
			}}</span>
			<Button
				variant="solid"
				size="sm"
				:disabled="matched.some((piece) => !piece)"
				:label="__('Check')"
				@click="check"
			/>
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

const pairs: { left: string; right: string }[] = props.moment.pairs || []
const pieces = pairs.map((pair) => pair.right).sort(() => Math.random() - 0.5)
const matched = ref<(string | null)[]>(
	props.result?.matched || pairs.map(() => null)
)
// Two pairs can share a right side, so a chip is spent by position, not by its text.
const used = ref<(number | null)[]>(pairs.map(() => null))
// The row a piece goes to: the one they tapped, else the first still empty.
const selected = ref<number | null>(0)

const firstEmpty = () => {
	const i = matched.value.indexOf(null)
	return i === -1 ? null : i
}

const choose = (i: number) => {
	if (props.result) return
	matched.value[i] = null
	used.value[i] = null
	selected.value = i
}

const place = (p: number) => {
	const i = selected.value ?? firstEmpty()
	if (i === null) return
	matched.value[i] = pieces[p]
	used.value[i] = p
	selected.value = firstEmpty()
}

const check = () => {
	if (props.result || matched.value.some((piece) => !piece)) return
	const wrong = pairs
		.map((pair, i) => ({
			left: pair.left,
			theirs: matched.value[i],
			right: pair.right,
		}))
		.filter((row) => row.theirs !== row.right)
	emit('answer', {
		correct: !wrong.length,
		matched: matched.value,
		summary: { wrong },
	})
}

const rowClass = (i: number) => {
	if (!props.result) {
		if (selected.value === i) return 'border-outline-gray-5 bg-surface-gray-1'
		return matched.value[i]
			? 'border-outline-gray-3 bg-surface-gray-1'
			: 'border-dashed border-outline-gray-3 bg-surface-base'
	}
	return matched.value[i] === pairs[i].right
		? 'border-outline-green-2 bg-surface-green-1'
		: 'border-outline-amber-2 bg-surface-amber-1'
}
</script>
