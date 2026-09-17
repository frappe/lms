<template>
	<span class="tool-tile" aria-hidden="true">
		<img
			v-if="image"
			:src="image"
			alt=""
			class="size-3.5 object-contain"
			loading="lazy"
		/>

		<component
			:is="glyph"
			v-else-if="glyph"
			class="tool-tile-glyph size-3.5"
		/>

		<svg v-else class="tool-tile-placeholder" viewBox="0 0 20 20" width="14" height="14">
			<rect width="20" height="20" rx="5" />
			<text
				x="10"
				y="10"
				text-anchor="middle"
				dominant-baseline="central"
				font-size="11"
				font-weight="600"
				font-family="ui-sans-serif, system-ui, sans-serif"
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

<style scoped>
/* token-exempt: a uniform white tile behind every mark, so a transparent brand
   logo stays legible in dark mode. It must NOT flip with the theme — and
   because the tile is fixed, the glyph and placeholder on it are fixed too.
   These live here rather than in the template so the reasoning is one comment
   instead of three, and so no comment renders into the DOM in dev. */
.tool-tile {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 1rem;
	height: 1rem;
	border-radius: 3px;
	background: #ffffff; /* token-exempt: fixed tile */
}
.tool-tile-glyph {
	color: #525252; /* token-exempt: fixed tile */
}
.tool-tile-placeholder rect {
	fill: #f1f1f1; /* token-exempt: fixed tile */
}
.tool-tile-placeholder text {
	fill: #6b6b6b; /* token-exempt: fixed tile */
}
</style>
