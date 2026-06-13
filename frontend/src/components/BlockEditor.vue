<template>
	<div
		ref="holderRef"
		class="bn-editor ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mx-2"
	></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import EditorJS from '@editorjs/editorjs'
import DragDrop from 'editorjs-drag-drop'
import { enablePlyr, getEditorTools } from '@/utils'

const props = defineProps({
	uploadContext: {
		type: Object,
		default: () => ({}),
	},
})

const emit = defineEmits(['change'])

const holderRef = ref(null)
let editor = null

onMounted(() => {
	editor = new EditorJS({
		holder: holderRef.value,
		tools: getEditorTools(false, props.uploadContext),
		defaultBlock: 'markdown',
		i18n: {
			direction: document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr',
		},
		onReady: () => {
			// Native EditorJS block menu (the ⋮⋮ settings button → Convert to
			// H1/H2/…, Move up/down, Delete) plus editorjs-drag-drop, which makes
			// that settings button a drag handle so blocks reorder by dragging.
			new DragDrop(editor)
		},
		onChange: async () => {
			enablePlyr()
			emit('change')
		},
	})
})

onBeforeUnmount(() => {
	const instance = editor
	editor = null
	instance?.isReady.then(() => instance.destroy()).catch(() => {})
})

defineExpose({
	isReady: () => editor.isReady,
	render: (data) => editor.render(data),
	save: () => editor.save(),
	// Put a blinking caret in the editor, ready to type. Prefers EditorJS's own
	// placement, but falls back to the first editable element when the boundary
	// block isn't focusable (e.g. a lesson that opens on a video embed).
	focus: (atEnd = false) => {
		if (!editor) return
		editor.caret?.focus(atEnd)
		if (holderRef.value?.contains(document.activeElement)) return
		holderRef.value
			?.querySelector('.codex-editor__redactor [contenteditable="true"]')
			?.focus()
	},
})
</script>

<!-- Editor chrome styles live in src/styles/blockEditor.css (global on
     purpose: EditorJS renders outside Vue's scope-attribute reach). -->
