<template>
	<div class="flex flex-col gap-1.5">
		<span v-if="label" class="px-1.5 text-xs-medium text-ink-gray-5">
			{{ label }}
		</span>
		<div
			class="flex flex-col overflow-hidden rounded-xl border border-outline-gray-1 bg-surface-base"
		>
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
// One card of settings rows under an optional group heading, the
// inset-grouped list mobile OSes use for their own settings. Rows draw their
// own separator; `overflow-hidden` keeps first/last row corners inside the radius.
//
// The heading reuses `text-xs-medium text-ink-gray-5` from the desktop
// settings sidebar's group labels. No `tracking-wide`: the token already
// carries 0.02em, and the utility emits later at equal specificity, overriding it.
defineProps<{ label?: string }>()
</script>
