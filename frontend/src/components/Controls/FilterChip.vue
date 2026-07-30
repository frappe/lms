<template>
	<!-- A filter that reads as pressable: outlined at rest, and the outline
	     itself takes the colour when it is on, so the toggle is legible
	     without a fill competing with the cards behind it. -->
	<button
		type="button"
		class="shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors"
		:class="active ? activeClass : REST_CLASS"
		:aria-pressed="active"
	>
		<slot />
	</button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FilterChipTheme } from '@/types'

const props = withDefaults(
	defineProps<{
		active?: boolean
		/** Which meaning the filter carries when it is on. */
		theme?: FilterChipTheme
	}>(),
	{ active: false, theme: 'gray' }
)

// Named here rather than passed in as a class string, so a page declares what a
// filter means and never which tokens say it.
const ACTIVE_CLASSES: Record<FilterChipTheme, string> = {
	gray: 'border-outline-gray-4 text-ink-gray-9',
	green: 'border-outline-green-2 text-ink-green-7',
	blue: 'border-outline-blue-2 text-ink-blue-7',
}

const REST_CLASS =
	'border-outline-gray-2 text-ink-gray-6 hover:border-outline-gray-3'

const activeClass = computed(() => ACTIVE_CLASSES[props.theme])
</script>
