// PdfBlock.vue is still a plain-JS SFC (`<script setup>` with no `lang="ts"`),
// so under `strict` it has no declaration and every TS test that imports it
// trips TS7016. Declaring it as what it is — a Vue component — costs nothing at
// runtime and keeps the type baseline from drifting.
//
// DELETE this file the moment PdfBlock.vue gains `lang="ts"`: a wildcard-free
// module declaration would otherwise shadow the SFC's real, inferred types.
declare module '@/components/PdfBlock.vue' {
	import type { Component } from 'vue'
	const component: Component
	export default component
}
