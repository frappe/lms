<template>
	<div
		ref="root"
		class="flex flex-col border-t border-outline-gray-1"
		:class="open ? 'min-h-0 flex-1' : 'shrink-0'"
	>
		<button
			type="button"
			data-testid="console-toggle"
			class="flex h-10 w-full shrink-0 items-center justify-between gap-x-2 px-3 text-start"
			:aria-expanded="open"
			@click="open = !open"
		>
			<span class="flex items-center gap-x-1.5">
				<span
					class="size-3.5 shrink-0 text-ink-gray-5"
					:class="open ? 'lucide-chevron-down' : 'lucide-chevron-right'"
				/>
				<span class="text-sm-semibold text-ink-gray-9">{{
					__('Console')
				}}</span>
			</span>
			<span class="flex items-center gap-x-2">
				<span v-if="duration !== null" class="text-xs text-ink-gray-5">
					{{ __('Ran in {0}s').format(duration.toFixed(2)) }}
				</span>
				<KeyboardShortcut combo="Mod+`" class="shrink-0 opacity-60" />
			</span>
		</button>

		<div v-if="open" class="min-h-0 flex-1 overflow-y-auto">
			<div
				v-if="running"
				class="flex items-center gap-x-2.5 px-3 pb-4 text-sm text-ink-gray-6"
			>
				<Spinner class="size-4 shrink-0" />
				{{ __('Running your code…') }}
			</div>

			<div
				v-else-if="lines.length"
				class="px-3 pb-4 font-mono text-sm leading-relaxed"
			>
				<div
					v-for="(line, index) in lines"
					:key="index"
					data-testid="console-line"
					class="whitespace-pre-wrap break-words"
					:class="lineClass(line)"
				>
					{{ line.text }}
				</div>
			</div>

			<div v-else class="flex items-center gap-x-2 px-3 pb-4">
				<span class="lucide-play size-4 shrink-0 text-ink-gray-4" />
				<span class="text-sm text-ink-gray-6">
					{{ __('Nothing to show yet — run your code') }}
				</span>
				<KeyboardShortcut combo="Mod+Enter" bg class="shrink-0" />
			</div>
		</div>
	</div>
</template>

<script lang="ts">
export type ConsoleLine = {
	text: string
	stream: 'stdout' | 'stderr' | 'command'
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { KeyboardShortcut, Spinner } from 'frappe-ui'
import {
	sameBlock,
	useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'

withDefaults(
	defineProps<{
		lines: ConsoleLine[]
		duration: number | null
		running?: boolean
	}>(),
	{ running: false }
)

const open = ref(true)
const root = ref<HTMLElement | null>(null)

useKeyboardShortcuts({
	// The point of the combo is to reach the console without leaving the code
	// editor, so this one deliberately fires while typing.
	ignoreTyping: false,
	shortcuts: [
		{
			match: (e) => (e.metaKey || e.ctrlKey) && e.key === '`',
			guard: sameBlock(root),
			action: () => (open.value = !open.value),
		},
	],
})

const lineClass = (line: ConsoleLine) => {
	if (line.stream === 'stderr') return 'text-ink-red-5'
	if (line.stream === 'command') return 'text-ink-gray-5'
	return 'text-ink-gray-8'
}
</script>
