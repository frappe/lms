<template>
	<Link
		:modelValue="modelValue ?? ''"
		doctype="LMS Category"
		:placeholder="__('Add category')"
		:aria-label="__('Category')"
		:inlineCreate="true"
		:inlineCreatePlaceholder="__('Category name')"
		:onCreate="onCreate"
		variant="ghost"
		trigger="button"
		icon="lucide-tag"
		@update:modelValue="(value: string) => emit('update:modelValue', value)"
	/>
</template>

<script setup lang="ts">
import Link from '@/components/Controls/Link.vue'
import { createLMSCategory } from '@/utils'
import { createHandler } from '@/utils/createHandler'

/** An LMS category picker that can create a category in place. */
defineProps<{ modelValue?: string | null }>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onCreate(value: string | null, done?: () => void): void {
	createHandler(value, done, (name) =>
		createLMSCategory(name).then((category: string | undefined) => {
			if (!category) return
			emit('update:modelValue', category)
			done?.()
		})
	)
}
</script>
