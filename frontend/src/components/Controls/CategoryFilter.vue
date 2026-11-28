<template>
	<Combobox
		:modelValue="modelValue || ''"
		trigger="button"
		variant="subtle"
		:options="options"
		:aria-label="label || __('Category')"
		class="w-fit"
		data-testid="category-filter"
		@update:modelValue="(value) => (modelValue = value || null)"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Combobox } from 'frappe-ui'

/** One category or All, picked from a searchable dropdown. */
const props = defineProps<{
	categories: string[]
	/** Names the filter when it is not a category, e.g. a type. */
	label?: string
	/** The no-filter option; defaults to "All categories". */
	allLabel?: string
}>()
const modelValue = defineModel<string | null>()

const options = computed(() => [
	{ label: props.allLabel || __('All categories'), value: '' },
	...props.categories.map((name) => ({ label: name, value: name })),
])
</script>
