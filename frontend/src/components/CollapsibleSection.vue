<template>
	<details :open="defaultOpen" class="group border-b">
		<summary class="flex items-center justify-between cursor-pointer p-5">
			<div
				class="flex items-center gap-2 text-base font-semibold text-ink-gray-9"
			>
				<ChevronDown
					class="size-4 stroke-1.5 -rotate-90 transition-transform duration-200 group-open:rotate-0"
				/>
				<span>{{ __(label) }}</span>
			</div>
			<div class="flex items-center gap-1" @click.stop>
				<slot name="actions" />
			</div>
		</summary>
		<div class="py-3.5 px-5">
			<slot />
		</div>
	</details>
</template>

<script setup>
import { ChevronDown } from 'lucide-vue-next'

defineProps({
	label: { type: String, default: '' },
	defaultOpen: { type: Boolean, default: true },
})
</script>

<style scoped>
summary {
	list-style: none;
}
summary::-webkit-details-marker {
	display: none;
}
</style>
