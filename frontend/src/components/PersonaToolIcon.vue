<template>
	<!-- Uniform white tile behind every mark so transparent logos stay visible
	     in dark mode (literal white on purpose — it must not flip with theme). -->
	<span
		class="inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-white"
		aria-hidden="true"
	>
		<img
			v-if="image"
			:src="image"
			alt=""
			class="size-3.5 object-contain"
			loading="lazy"
		/>

		<!-- Non-brand options: neutral Lucide glyphs. Fixed gray, not an ink
		     token — the tile stays white in dark mode, so the glyph must too. -->
		<component :is="glyph" v-else-if="glyph" class="size-3.5 text-[#525252]" />

		<!-- Unknown tool: neutral placeholder -->
		<svg v-else viewBox="0 0 20 20" width="14" height="14">
			<rect width="20" height="20" rx="5" fill="#F1F1F1" />
			<text
				x="10"
				y="10"
				text-anchor="middle"
				dominant-baseline="central"
				font-size="11"
				font-weight="600"
				font-family="ui-sans-serif, system-ui, sans-serif"
				fill="#6B6B6B"
			>
				?
			</text>
		</svg>
	</span>
</template>

<script setup>
import { computed, markRaw } from 'vue'
import { CircleDashed, Ellipsis } from 'lucide-vue-next'
import toolLogos from '@/assets/images/persona-icons'

const props = defineProps({
	name: {
		type: String,
		default: '',
	},
})

// Neutral glyphs for the non-brand options.
const GLYPHS = {
	no_lms: markRaw(CircleDashed),
	other: markRaw(Ellipsis),
}

// Brand assets resolve by filename from the persona-icons folder.
const image = computed(() => toolLogos[props.name])
const glyph = computed(() => GLYPHS[props.name])
</script>
