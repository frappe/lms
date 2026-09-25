<template>
	<div
		class="overflow-x-auto rounded border border-outline-gray-2 bg-surface-gray-1 py-2 font-mono text-p-sm"
		data-testid="copilot-diff"
	>
		<div
			v-for="(line, index) in lines"
			:key="index"
			class="whitespace-pre px-3"
			:class="lineClass(line.op)"
		>
			{{ diffLine(line) }}
		</div>
	</div>
</template>

<script setup>
import { diffLine } from './format'

defineProps({
	lines: { type: Array, default: () => [] },
})

function lineClass(op) {
	if (op === 'add') return 'bg-surface-green-2 text-ink-green-8'
	if (op === 'del') return 'bg-surface-red-2 text-ink-red-8 line-through'
	if (op === 'skip') return 'italic text-ink-gray-5'
	return 'text-ink-gray-8'
}
</script>
