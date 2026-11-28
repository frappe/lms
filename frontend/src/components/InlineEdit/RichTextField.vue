<template>
	<RichTextEditor
		:content="modelValue"
		:ariaLabelledby="ariaLabelledby"
		:placeholder="placeholder"
		:toolbar="TOOLBAR"
		:uploadArgs="{ private: false }"
		menuOnFocus
		roomy
		variant="inline"
		minHeight="8rem"
		editorClass="prose-sm text-p-base text-ink-gray-8"
		:ariaInvalid="missing || undefined"
		:class="[missingRing(missing), bleed && BLEED_RICH_TEXT]"
		@change="(value: string) => emit('update:modelValue', value)"
	/>
</template>

<script setup lang="ts">
import {
	Blockquote,
	Bold,
	BulletList,
	HeadingGroup,
	InlineCode,
	InsertImage,
	InsertLink,
	Italic,
	OrderedList,
	Paragraph,
	Redo,
	Separator,
	Undo,
} from 'frappe-ui/editor'
import RichTextEditor from '@/components/RichTextEditor.vue'
import {
	BLEED_RICH_TEXT,
	missingRing,
} from '@/components/InlineEdit/fieldClasses'

/**
 * A long-form body that shows its box and toolbar only while editing.
 * Course and batch bodies are shown to guests, so images upload public.
 */
defineProps<{
	modelValue?: string | null
	placeholder: string
	ariaLabelledby: string
	missing?: boolean
	/** Line its text up with the surrounding text, padding outside. */
	bleed?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const TOOLBAR = [
	Paragraph,
	HeadingGroup,
	Separator,
	Bold,
	Italic,
	InsertLink,
	InlineCode,
	Separator,
	BulletList,
	OrderedList,
	Blockquote,
	Separator,
	InsertImage,
	Separator,
	Undo,
	Redo,
]
</script>
