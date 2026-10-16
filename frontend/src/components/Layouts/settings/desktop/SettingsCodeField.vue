<template>
	<InputLabel
		:id="labelId"
		:label="__(field.label)"
		:required="field.reqd"
		data-testid="code-field-label"
	/>
	<CodeEditor
		:model-value="modelValue ?? ''"
		:extensions="extensions"
		:editable="!field.disabled"
		@update:model-value="(value: string) => (modelValue = value)"
		@change="(value: string) => emit('change', value)"
	>
		<CodeEditorContent
			class="mt-1"
			:style="{ '--code-max-height': height, minHeight: height }"
		/>
	</CodeEditor>
	<InputDescription
		v-if="field.description"
		:id="descriptionId"
		:description="__(field.description)"
		class="mt-1"
		data-testid="code-field-description"
	/>
</template>

<script setup lang="ts">
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { computed, shallowRef, useId, watch } from 'vue'
import {
	CodeEditor,
	CodeEditorContent,
	CodeKit,
	loadLanguage,
} from 'frappe-ui/code-editor'
import { InputDescription, InputLabel } from 'frappe-ui/experimental'
import type { SettingsField } from '@/types/settingsSchema'

type CodeField = Extract<SettingsField, { type: 'code' }>

const props = defineProps<{ field: CodeField }>()
const modelValue = defineModel<string | null>()
const emit = defineEmits<{ change: [value: string] }>()

const labelId = useId()
const descriptionId = useId()

// Schema uses CodeMirror 5 mode names, editor wants CodeMirror 6 keys.
// Unmapped falls back to html, the old default.
const CODE_LANGUAGES: Record<string, string> = {
	htmlmixed: 'html',
	javascript: 'javascript',
}

const language = computed(() => CODE_LANGUAGES[props.field.mode] || 'html')

// 25px a row matches the old hardcoded 250px for `rows: 10`. Min and max pin
// the box so Email Template's Use HTML swap with fixed-height rich text moves
// nothing below.
const height = computed(() => `${(props.field.rows ?? 10) * 25}px`)

// Line numbers kept since the pre-v1 editor drew them. Completion off, the
// field has no sources.
const kit = CodeKit.configure({ lineNumbers: {}, autocompletion: false })

const languageExtension = shallowRef<Extension | null>(null)
watch(
	language,
	async (key) => {
		let loaded: Extension | null = null
		try {
			loaded = await loadLanguage(key)
		} catch (error) {
			console.error(error)
		}
		if (language.value === key) languageExtension.value = loaded
	},
	{ immediate: true }
)

const contentAttributes = computed(() =>
	EditorView.contentAttributes.of({
		'aria-labelledby': labelId,
		'aria-describedby': props.field.description ? descriptionId : '',
		'aria-required': props.field.reqd ? 'true' : 'false',
	})
)

const extensions = computed<Extension[]>(() => {
	const list: Extension[] = [kit, contentAttributes.value]
	if (languageExtension.value) list.push(languageExtension.value)
	return list
})
</script>
