<template>
	<div>
		<p class="mb-3 text-p-sm text-ink-gray-7">{{ moment.prompt }}</p>
		<!-- One row per part of the scene, two columns when there is room, so a long
		     scene fits without scrolling. -->
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<button
				v-for="(segment, i) in moment.segments"
				:key="i"
				type="button"
				:disabled="!!result"
				:aria-pressed="picked.has(i)"
				class="flex items-start gap-2 rounded-5 border px-3 py-2 text-start text-p-sm text-ink-gray-9 transition-colors"
				:class="segmentClass(i)"
				@click="toggle(i)"
			>
				<span
					class="mt-0.5 size-4 shrink-0"
					:class="segmentIcon(i)"
					aria-hidden="true"
				/>
				<span>{{ segment.text }}</span>
			</button>
		</div>
		<div v-if="!result" class="mt-3 flex items-center justify-between">
			<span class="text-p-xs text-ink-gray-6">{{
				active && moment.segments.length <= 9
					? __('Tap to mark, or press 1 to {0}. Enter checks.', [
							moment.segments.length,
					  ])
					: __('Tap to mark, tap again to undo.')
			}}</span>
			<Button
				variant="solid"
				size="sm"
				:disabled="!picked.size"
				@click="check"
				>{{ __('Check') }}</Button
			>
		</div>
		<p v-else class="mt-3 text-p-sm text-ink-gray-7">
			{{
				result.correct
					? __('You spotted them all.')
					: __(
							'Highlighted in green: what to watch for. Your tutor will walk you through it.'
					  )
			}}
		</p>
	</div>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useMomentKeys } from '@/composables/useMomentKeys'
import { Button } from 'frappe-ui'

const props = defineProps<{
	moment: Record<string, any>
	result?: Record<string, any> | null
	active?: boolean
}>()
const emit = defineEmits<{ answer: [result: Record<string, unknown>] }>()

const picked = ref(new Set<number>(props.result?.picked || []))

const toggle = (i: number) => {
	const next = new Set(picked.value)
	if (next.has(i)) next.delete(i)
	else next.add(i)
	picked.value = next
}

const check = () => {
	const segments = props.moment.segments as {
		text: string
		is_issue: boolean
	}[]
	const missed = segments
		.filter((s, i) => s.is_issue && !picked.value.has(i))
		.map((s) => s.text)
	const wrong = segments
		.filter((s, i) => !s.is_issue && picked.value.has(i))
		.map((s) => s.text)
	emit('answer', {
		correct: !missed.length && !wrong.length,
		picked: [...picked.value],
		summary: { missed, marked_but_fine: wrong },
	})
}

const segmentClass = (i: number) => {
	const segment = props.moment.segments[i]
	if (!props.result)
		return picked.value.has(i)
			? 'border-outline-amber-2 bg-surface-amber-2 text-ink-gray-9'
			: 'border-outline-gray-2 bg-surface-base hover:border-outline-gray-4'
	if (segment.is_issue)
		return 'border-outline-green-2 bg-surface-green-2 text-ink-gray-9'
	if (picked.value.has(i))
		return 'border-outline-red-2 bg-surface-red-2 text-ink-gray-9 line-through'
	return 'border-outline-gray-1 bg-surface-base text-ink-gray-6'
}

const segmentIcon = (i: number) => {
	const segment = props.moment.segments[i]
	if (!props.result)
		return picked.value.has(i)
			? 'lucide-square-check text-ink-amber-7'
			: 'lucide-square text-ink-gray-6'
	if (segment.is_issue) return 'lucide-circle-alert text-ink-green-7'
	if (picked.value.has(i)) return 'lucide-circle-x text-ink-red-6'
	return 'lucide-circle text-ink-gray-4'
}

useMomentKeys(
	toRef(props, 'active'),
	() => (props.result ? 0 : props.moment.segments.length),
	toggle,
	() => {
		if (!props.result && picked.value.size) check()
	}
)
</script>
