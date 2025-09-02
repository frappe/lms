<template>
	<div class="text-lg font-semibold mb-4">
		{{ __('My Notes') }}
	</div>
	<TextEditor
		:content="note"
		:placeholder="__('Make notes for quick revision. Press / for menu.')"
		@change="(val: string) => updateNoteText(val)"
		:editable="true"
		editorClass="prose prose-sm min-h-[200px] max-w-none"
	/>
</template>
<script setup lang="ts">
import { TextEditor } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { inject, ref, onMounted, watch } from 'vue'
import type { Note, Notes } from '@/components/Notes/types'
import { blockQuotesClick } from '@/utils/'

const note = ref<string | null>(null)
const currentNoteName = ref<string | null>(null)
const user = inject<any>('$user')
const notes = defineModel<Notes>('notes')
const emit = defineEmits<{
	(e: 'updateNotes'): void
}>()

const props = defineProps<{
	lesson: string
}>()

onMounted(() => {
	updateCurrentNote()
})

watch(
	() => notes.value?.data,
	() => {
		updateCurrentNote()
		blockQuotesClick()
	}
)

const updateCurrentNote = () => {
	const currentNote = notes.value?.data?.filter((row: Note) => {
		return !row.highlighted_text && row.note !== ''
	})
	if (currentNote?.length === 0) {
		note.value = null
		currentNoteName.value = null
		return
	} else if (currentNote && currentNote.length > 0) {
		currentNoteName.value = currentNote[0].name
		note.value = currentNote[0].note || null
	}
}

const updateNoteText = (val: string) => {
	note.value = val
	debouncedSave()
}

const debouncedSave = useDebounceFn(() => {
	saveNotes()
}, 2000)

const saveNotes = () => {
	if (currentNoteName.value) {
		updateNote()
	} else {
		createNote()
	}
}

const createNote = () => {
	notes.value?.insert.submit(
		{
			lesson: props.lesson,
			member: user?.data?.name,
			note: note.value,
			color: 'Yellow',
			name: '',
		},
		{
			onSuccess(data: Note) {
				currentNoteName.value = data.name || null
				emit('updateNotes')
			},
			onError(err: any) {
				console.error('Error creating note:', err)
			},
		}
	)
}

const updateNote = () => {
	if (!currentNoteName.value) return
	notes.value?.setValue.submit(
		{
			name: currentNoteName.value,
			lesson: props.lesson,
			member: user?.data?.name,
			note: note.value,
		},
		{
			onSuccess(data: Note) {
				emit('updateNotes')
			},
			onError(err: any) {
				console.error('Error updating note:', err)
			},
		}
	)
}
</script>
