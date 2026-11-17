<template>
	<router-link v-if="to && external" v-external :to="to" :class="linkClass">
		<slot />
	</router-link>
	<router-link v-else-if="to" :to="to" :class="linkClass">
		<slot />
	</router-link>
	<slot v-else />
</template>
<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// The card's one link. Its overlay stretches over the nearest positioned
// ancestor, so the whole card is clickable while links inside it stay valid;
// those sit above the overlay with `relative z-10`.
defineProps<{
	to?: RouteLocationRaw
	external?: boolean
}>()

const linkClass =
	'outline-none after:absolute after:inset-0 after:rounded-5 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-outline-gray-5'
</script>
