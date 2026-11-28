<template>
	<div class="relative">
		<div :class="{ invisible: active }">
			<slot />
		</div>
		<div
			v-if="active"
			class="absolute inset-0 overflow-hidden motion-safe:animate-pulse"
			aria-hidden="true"
			data-testid="skeleton-overlay"
		>
			<slot name="skeleton" />
		</div>
	</div>
</template>
<script setup lang="ts">
/**
 * Lays a skeleton over fields that are mounted but not filled yet. The fields
 * stay in the layout, hidden, so the box is exactly as tall as when they fill.
 */
defineProps<{ active: boolean }>()
</script>
