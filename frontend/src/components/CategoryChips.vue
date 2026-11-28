<template>
	<!-- One row that scrolls sideways inside itself, with no scrollbar drawn. -->
	<div
		class="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		role="group"
		:aria-label="__('Category')"
	>
		<button
			v-for="option in [allCategories, ...options]"
			:key="String(option.value)"
			type="button"
			class="shrink-0 whitespace-nowrap rounded-4 border px-2.5 py-1 text-p-sm outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
			:class="
				model === option.value
					? 'border-transparent bg-surface-gray-2 text-ink-gray-9'
					: 'border-outline-gray-2 text-ink-gray-7 hover:border-outline-gray-3'
			"
			:aria-pressed="model === option.value"
			:data-testid="'category-' + option.label"
			@click="pick($event, option.value)"
		>
			{{ option.label }}
		</button>
	</div>
</template>

<script setup lang="ts">
/** Category chips for a list: picking the chosen one again goes back to All. */
defineProps<{ options: { label: string; value: string }[] }>()
const model = defineModel<string | null>({ default: null })
const allCategories = { label: __('All'), value: null }

function pick(event: MouseEvent, value: string | null): void {
	model.value = model.value === value ? null : value
	;(event.currentTarget as HTMLElement).scrollIntoView?.({
		block: 'nearest',
		inline: 'nearest',
	})
}
</script>
