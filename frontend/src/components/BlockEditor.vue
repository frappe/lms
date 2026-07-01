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
import { enablePlyr, getEditorTools, getEditorTunes } from '@/utils'

const props = defineProps({
	uploadContext: {
		type: Object,
		default: () => ({}),
	},
})

const emit = defineEmits(['change'])

const holderRef = ref(null)
let editor = null

// Clicking the empty area below the last block (the redactor's bottom padding)
// drops the caret into a fresh block — or focuses the last one if it's already
// empty — so you can keep writing without hunting for the "+" handle. Detect
// "below the last block" geometrically (click Y past the last block's bottom)
// so it works regardless of which element receives the click.
function handleBelowLastBlockClick(e) {
	if (!editor) return
	const blocks = holderRef.value?.querySelectorAll('.ce-block')
	if (!blocks?.length) return
	const lastBottom = blocks[blocks.length - 1].getBoundingClientRect().bottom
	if (e.clientY <= lastBottom) return
	const count = editor.blocks.getBlocksCount()
	const last = editor.blocks.getBlockByIndex(count - 1)
	if (last?.isEmpty) {
		editor.caret.setToBlock(count - 1, 'end')
	} else {
		// Insert a default block at the end and move the caret into it.
		editor.blocks.insert('markdown', {}, {}, count, true)
	}
}

// Keep one empty block at the very end so there's always something below the
// last bit of content to hover (surfacing the +/⋮⋮ toolbar) and click into.
// It's synthetic: stripped from save() output, and its own insertion is
// suppressed so it never marks the lesson dirty or triggers an autosave.
let suppressChange = false

function isEmptyTextBlock(block) {
	if (block?.type !== 'markdown' && block?.type !== 'paragraph') return false
	const text = block?.data?.text
	return (
		text == null ||
		String(text)
			.replace(/<br\s*\/?>/gi, '')
			.trim() === ''
	)
}

function ensureTrailingBlock() {
	if (!editor) return
	const count = editor.blocks.getBlocksCount()
	if (!count) return
	const last = editor.blocks.getBlockByIndex(count - 1)
	if (last && !last.isEmpty) {
		suppressChange = true
		// Append at the end without stealing the caret from where the user is.
		editor.blocks.insert('markdown', {}, {}, count, false)
	}
}

onMounted(() => {
	editor = new EditorJS({
		holder: holderRef.value,
		tools: getEditorTools(false, props.uploadContext),
		tunes: getEditorTunes(),
		defaultBlock: 'markdown',
		i18n: {
			direction: document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr',
		},
		onReady: () => {
			// onReady can fire after the component unmounted (fast nav / deleting
			// the open lesson) — by then onBeforeUnmount has nulled `editor`. Bail
			// so we don't call `new DragDrop(null)`, whose constructor reads
			// editor.configuration and throws.
			if (!editor) return
			// Native EditorJS block menu (the ⋮⋮ settings button → Convert to
			// H1/H2/…, Move up/down, Delete) plus editorjs-drag-drop, which makes
			// that settings button a drag handle so blocks reorder by dragging.
			new DragDrop(editor)
			holderRef.value?.addEventListener('click', handleBelowLastBlockClick)
		},
		onChange: async () => {
			enablePlyr()
			// Don't propagate (or autosave) our own synthetic trailing block.
			if (suppressChange) suppressChange = false
			else emit('change')
			ensureTrailingBlock()
		},
	})
})

onBeforeUnmount(() => {
	holderRef.value?.removeEventListener('click', handleBelowLastBlockClick)
	const instance = editor
	editor = null
	instance?.isReady.then(() => instance.destroy()).catch(() => {})
})

defineExpose({
	// All editor-instance access below is null-guarded: a debounced parent
	// autosave can call these after onBeforeUnmount has nulled `editor`.
	isReady: () => editor?.isReady ?? Promise.resolve(),
	render: async (data) => {
		if (!editor) return
		await editor.render(data)
		ensureTrailingBlock()
	},
	save: async () => {
		if (!editor) return null
		const data = await editor.save()
		// Drop the synthetic trailing empty block so it's never persisted.
		if (
			data.blocks.length &&
			isEmptyTextBlock(data.blocks[data.blocks.length - 1])
		) {
			data.blocks = data.blocks.slice(0, -1)
		}
		return data
	},
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
