// PdfBlock.vue is still a plain-JS SFC (`<script setup>` with no `lang="ts"`),
// so under `strict` it has no declaration and every TS test that imports it
// trips TS7016. Declaring it as what it is (a Vue component) costs nothing at
// runtime and keeps the type baseline from drifting.
//
// DELETE this file the moment PdfBlock.vue gains `lang="ts"`: a wildcard-free
// module declaration would otherwise shadow the SFC's real, inferred types.
declare module '@/components/PdfBlock.vue' {
	import type { Component } from 'vue'
	const component: Component
	export default component
}

// Same situation for IconPicker.vue: it stays a plain-JS SFC on purpose,
// because its icon-lookup code (`icons[selectedIcon]`, a reduce building an
// object keyed by icon name) would need a real typing pass to convert
// cleanly under `strict`; converting it just to silence TS7016 would trade
// one tolerated error for several new ones. controlLabeling.test.ts (a .ts
// file) imports it directly, which trips the same TS7016 as PdfBlock.vue did.
//
// DELETE this entry the moment IconPicker.vue gains `lang="ts"`.
declare module '@/components/Controls/IconPicker.vue' {
	import type { Component } from 'vue'
	const component: Component
	export default component
}
