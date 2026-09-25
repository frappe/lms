<template>
	<section class="py-16 text-center">
		<h1 class="text-lg-semibold text-ink-gray-9">{{ title }}</h1>
		<p v-if="text" class="mt-2 text-p-base text-ink-gray-5">{{ text }}</p>
		<slot />
	</section>
</template>

<script setup>
defineProps({
	title: { type: String, required: true },
	text: { type: String, default: '' },
})
</script>
