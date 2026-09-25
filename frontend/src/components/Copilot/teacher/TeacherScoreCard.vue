<template>
	<div
		class="rounded-6 border p-3"
		:class="flagged ? 'border-outline-amber-3' : 'border-outline-gray-2'"
		data-testid="copilot-score"
	>
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-base-semibold text-ink-gray-9">{{
				score.criterion
			}}</span>
			<span class="flex-1" />
			<div
				class="flex gap-1"
				role="group"
				:aria-label="__('Level for {0}').format(score.criterion)"
			>
				<button
					v-for="level in maxLevel"
					:key="level"
					type="button"
					class="relative size-7 rounded text-p-base transition-colors disabled:cursor-not-allowed"
					:class="
						modelValue === level
							? 'bg-surface-gray-10 text-ink-base'
							: 'bg-surface-gray-2 text-ink-gray-8 hover:bg-surface-gray-3'
					"
					:aria-pressed="modelValue === level ? 'true' : 'false'"
					:title="
						score.level === level
							? __('Level suggested by the assistant')
							: undefined
					"
					:disabled="!editable"
					@click="emit('update:modelValue', level)"
				>
					{{ level }}
					<span
						v-if="score.level === level"
						aria-hidden="true"
						class="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-surface-violet-7"
					/>
				</button>
			</div>
		</div>
		<p class="mt-2 whitespace-pre-wrap text-p-base text-ink-gray-7">
			{{ score.reason }}
		</p>
		<div v-if="score.citations?.length" class="mt-2 flex flex-wrap gap-1.5">
			<template v-for="(citation, index) in score.citations" :key="index">
				<button
					v-if="citation.file"
					type="button"
					class="rounded bg-surface-gray-2 px-1.5 py-0.5 font-mono text-p-xs text-ink-gray-8 hover:bg-surface-gray-3"
					@click="emit('cite', citation)"
				>
					{{ citationLabel(citation) }}
				</button>
				<span
					v-else
					class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-p-xs text-ink-gray-7"
				>
					{{ citationLabel(citation) }}
				</span>
			</template>
		</div>
		<div v-if="flagged" class="mt-2 text-p-sm text-ink-amber-8">
			{{
				__('Confidence: {0} · needs a closer look').format(
					confidenceLabel(score.confidence)
				)
			}}
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import { citationLabel, confidenceLabel } from './format'

const props = defineProps({
	score: { type: Object, required: true },
	modelValue: { type: Number, default: null },
	editable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'cite'])

const flagged = computed(() => props.score.confidence !== 'High')
const maxLevel = computed(() => props.score.max_level || 3)
</script>
