<template>
	<div>
		<component
			:is="multiline ? 'textarea' : 'input'"
			ref="field"
			:value="draft"
			:rows="multiline ? 3 : undefined"
			:placeholder="placeholder"
			:aria-label="label"
			:class="textClass"
			class="inline-edit -mx-1.5 block w-[calc(100%+0.75rem)] resize-none rounded-4 border-0 bg-transparent px-1.5 py-0.5 placeholder:text-ink-gray-4 hover:bg-surface-gray-2 focus:bg-surface-base focus:outline-none focus:ring-1 focus:ring-outline-gray-2"
			@input="draft = ($event.target as HTMLInputElement).value"
			@keydown.enter.exact.prevent=";($event.target as HTMLElement).blur()"
			@keydown.esc.prevent="cancel"
			@blur="commit"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
	defineProps<{
		modelValue?: string | null
		label: string
		placeholder?: string
		multiline?: boolean
		/** Type style for the text itself; form styles would override one set on a parent. */
		textClass?: string
	}>(),
	{ modelValue: '', placeholder: '', multiline: false, textClass: '' }
)
const emit = defineEmits<{
	'update:modelValue': [value: string]
	save: []
}>()

const field = ref<HTMLInputElement | null>(null)
const draft = ref(props.modelValue || '')
let cancelling = false

watch(
	() => props.modelValue,
	(value) => {
		if (document.activeElement !== field.value) draft.value = value || ''
	}
)

// Enter and leaving the field both save; Esc puts back what was there.
const commit = () => {
	if (cancelling) {
		cancelling = false
		return
	}
	const value = draft.value.trim()
	if (value === (props.modelValue || '').trim()) return
	emit('update:modelValue', value)
	emit('save')
}

const cancel = () => {
	cancelling = true
	draft.value = props.modelValue || ''
	field.value?.blur()
}
</script>

<style scoped>
/* A multi-line field grows with its text, so it reads like a paragraph. */
textarea.inline-edit {
	field-sizing: content;
	min-height: 1.5lh;
}
</style>
