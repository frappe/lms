<script setup>
const props = defineProps({
	src: {
		type: String,
		default: '',
	},
	title: {
		type: String,
		default: '',
	},
	type: {
		type: String,
		default: 'course',
	},
})
</script>

<template>
	<div
		class="relative w-full h-full overflow-hidden bg-[#fafafa] flex flex-col items-center justify-center p-[5%]"
	>
		<div class="w-[20%] aspect-[4/3] relative mb-[2%] opacity-40">
			<svg
				viewBox="0 0 24 24"
				class="w-full h-full text-[#333]"
				fill="none"
				stroke="currentColor"
				stroke-width="1"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
				<circle cx="8.5" cy="9.5" r="1.5" />
				<polyline points="22 16 16 10 5 20" />
			</svg>
		</div>

		<div class="flex flex-col items-center text-center opacity-40">
			<span class="text-[#333] text-base leading-tight">No Image</span>
		</div>
	</div>
</template>

<style scoped>
.relative {
	container-type: size;
}
</style>
