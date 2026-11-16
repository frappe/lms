<template>
	<div>
		<p v-if="moment.prompt" class="mb-3 text-p-sm text-ink-gray-7">
			{{ moment.prompt }}
		</p>
		<!-- The sentence reads as one line of prose; each blank is a tappable chip inside it. -->
		<p class="text-p-base leading-8 text-ink-gray-9">
			<template v-for="(part, i) in parts" :key="i">
				<span>{{ part }}</span>
				<button
					v-if="i < blanks"
					type="button"
					:disabled="!!result || !filled[i]"
					class="mx-1 inline-flex min-w-16 items-center justify-center rounded-4 border px-2 py-0.5 align-baseline text-p-sm transition-colors"
					:class="blankClass(i)"
					:aria-label="
						filled[i]
							? __('Blank {0}: {1}. Tap to clear').format(i + 1, filled[i])
							: __('Blank {0}, empty').format(i + 1)
					"
					@click="filled[i] = null"
				>
					{{ filled[i] || ' ' }}
				</button>
			</template>
		</p>
		<ul
			v-if="result && wrongBlanks.length"
			class="mt-2 space-y-0.5 text-p-xs text-ink-gray-7"
		>
			<li v-for="row in wrongBlanks" :key="row.blank">
				{{ __('Blank {0}: {1}').format(row.blank, row.right) }}
			</li>
		</ul>
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
		<div v-if="!result" class="mt-3 flex items-center justify-between gap-3">
			<span class="text-p-xs text-ink-gray-6">{{
				__('Tap a piece to fill the next blank')
			}}</span>
			<Button
				variant="solid"
				size="sm"
				:disabled="!blanks || filled.some((piece) => !piece)"
				:label="__('Check')"
				@click="check"
			/>
		</div>
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

const parts: string[] = String(props.moment.text || '').split(/_{3,}/)
const answers: string[] = (props.moment.answers || []).slice(
	0,
	parts.length - 1
)
// A blank the model forgot an answer for is not shown, so the sentence still checks.
const blanks = answers.length
const pieces = [...answers, ...(props.moment.extra_pieces || [])]
	.filter((piece, i, all) => piece && all.indexOf(piece) === i)
	.sort(() => Math.random() - 0.5)
const filled = ref<(string | null)[]>(
	props.result?.filled || answers.map(() => null)
)

const place = (piece: string) => {
	const empty = filled.value.indexOf(null)
	if (empty !== -1) filled.value[empty] = piece
}

const rows = () =>
	answers.map((right, i) => ({
		blank: i + 1,
		theirs: filled.value[i],
		right,
	}))
const wrongBlanks = computed(() =>
	rows().filter((row) => row.theirs !== row.right)
)

const check = () => {
	if (props.result || !blanks || filled.value.some((piece) => !piece)) return
	const wrong = wrongBlanks.value
	emit('answer', {
		correct: !wrong.length,
		filled: filled.value,
		summary: { wrong },
	})
}

const blankClass = (i: number) => {
	if (!props.result)
		return filled.value[i]
			? 'border-outline-gray-3 bg-surface-gray-1 font-medium'
			: 'border-dashed border-outline-gray-4 bg-surface-base'
	return filled.value[i] === answers[i]
		? 'border-outline-green-2 bg-surface-green-1 font-medium'
		: 'border-outline-amber-2 bg-surface-amber-1 font-medium'
}
</script>
