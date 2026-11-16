<template>
	<div>
		<p class="mb-3 text-p-base text-ink-gray-9">{{ moment.prompt }}</p>
		<div class="flex flex-col gap-2">
			<div
				v-for="(item, i) in items"
				:key="i"
				class="rounded-5 border px-3 py-2.5 transition-colors"
				:class="rowClass(i)"
			>
				<!-- The item reads as a full line; the buckets sit under it, the same on every width. -->
				<div class="flex flex-col gap-2">
					<span class="text-p-sm text-ink-gray-9">{{ item.text }}</span>
					<div
						class="flex shrink-0 flex-wrap gap-1.5"
						role="radiogroup"
						:aria-label="item.text"
					>
						<button
							v-for="(bucket, b) in buckets"
							:key="b"
							type="button"
							role="radio"
							:disabled="!!result"
							class="rounded-4 border px-2 py-1 text-p-xs transition-colors"
							:class="chipClass(i, b)"
							:aria-checked="placed[i] === b"
							@click="place(i, b)"
						>
							{{ bucket }}
						</button>
					</div>
				</div>
				<p
					v-if="result && placed[i] !== item.bucket"
					class="mt-1.5 text-p-xs text-ink-gray-7"
				>
					{{ __('Belongs in {0}').format(buckets[item.bucket]) }}
				</p>
			</div>
		</div>
		<div v-if="!result" class="mt-3 flex items-center justify-between gap-3">
			<span class="text-p-xs text-ink-gray-6">{{
				__('Tap a bucket for each one, then check')
			}}</span>
			<Button
				variant="solid"
				size="sm"
				:disabled="placed.some((b) => b === null)"
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

const buckets: string[] = props.moment.buckets || []
const items: { text: string; bucket: number }[] = props.moment.items || []
const placed = ref<(number | null)[]>(
	props.result?.placed || items.map(() => null)
)

const place = (i: number, b: number) => {
	if (!props.result) placed.value[i] = b
}

const check = () => {
	if (props.result || placed.value.some((b) => b === null)) return
	const wrong = items
		.map((item, i) => ({
			item: item.text,
			theirs: buckets[placed.value[i] as number],
			right: buckets[item.bucket],
		}))
		.filter((row) => row.theirs !== row.right)
	emit('answer', {
		correct: !wrong.length,
		placed: placed.value,
		summary: { wrong },
	})
}

const rowClass = (i: number) => {
	if (!props.result) return 'border-outline-gray-2 bg-surface-base'
	return placed.value[i] === items[i].bucket
		? 'border-outline-green-2 bg-surface-green-1'
		: 'border-outline-amber-2 bg-surface-amber-1'
}

// Before the check a chip only shows the pick; after it, the right bucket is outlined
// wherever they went wrong, so the row teaches without a second look.
const chipClass = (i: number, b: number) => {
	const mine = placed.value[i] === b
	if (!props.result)
		return mine
			? 'border-outline-gray-5 bg-surface-gray-7 text-ink-gray-1'
			: 'border-outline-gray-2 bg-surface-base text-ink-gray-7 hover:bg-surface-gray-1'
	const right = items[i].bucket === b
	if (mine && right)
		return 'border-outline-green-2 bg-surface-base text-ink-green-3'
	if (mine) return 'border-outline-amber-2 bg-surface-base text-ink-amber-3'
	if (right) return 'border-dashed border-outline-green-2 text-ink-gray-7'
	return 'border-outline-gray-1 text-ink-gray-6 opacity-60'
}
</script>
