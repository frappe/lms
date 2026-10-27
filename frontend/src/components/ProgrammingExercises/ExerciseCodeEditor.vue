<template>
	<CodeEditor v-model="code" :extensions="extensions">
		<CodeEditorContent
			data-testid="exercise-code-editor"
			:class="['h-full', contentClass]"
			:style="{ '--code-radius': '0', '--code-bg': 'var(--surface-base)' }"
		/>
	</CodeEditor>
</template>

<script setup lang="ts">
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { computed, shallowRef, watch } from 'vue'
import {
	CodeEditor,
	CodeEditorContent,
	CodeKit,
	loadLanguage,
} from 'frappe-ui/code-editor'
import type { LanguageKey } from 'frappe-ui/code-editor'
import type { ExerciseLanguage } from '@/types'

const code = defineModel<string>({ required: true })

const props = withDefaults(
	defineProps<{
		language: ExerciseLanguage
		label: string
		contentClass?: string
		readonly?: boolean
	}>(),
	{ contentClass: 'min-h-[16rem]', readonly: false }
)

const LANGUAGE_KEYS: Record<ExerciseLanguage, LanguageKey> = {
	Python: 'python',
	JavaScript: 'javascript',
}

const kit = CodeKit.configure({ lineNumbers: {}, autocompletion: false })

const languageExtension = shallowRef<Extension | null>(null)

watch(
	() => props.language,
	async (language) => {
		let loaded: Extension | null = null
		try {
			loaded = await loadLanguage(LANGUAGE_KEYS[language])
		} catch (error) {
			console.error(error)
		}
		if (props.language === language) languageExtension.value = loaded
	},
	{ immediate: true }
)

const accessibleName = computed(() =>
	EditorView.contentAttributes.of({ 'aria-label': props.label })
)

const extensions = computed<Extension[]>(() => {
	const list: Extension[] = [kit, accessibleName.value]
	if (languageExtension.value) list.push(languageExtension.value)
	if (props.readonly) {
		list.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
	}
	return list
})
</script>
