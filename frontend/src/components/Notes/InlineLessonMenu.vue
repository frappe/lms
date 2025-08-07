<template>
	<div
		class="text-sm absolute bg-white border rounded-md z-10 w-44"
		:style="{
			display: top > 0 ? 'block' : 'none',
			top: top + 'px',
			left: left + 'px',
		}"
	>
		<div class="space-y-2 py-2">
			<div class="text-xs text-ink-gray-5 font-medium px-3">
				{{ __('Highlight') }}
			</div>
			<div class="">
				<div
					v-for="color in colors"
					class="flex items-center space-x-2 px-3 py-2 cursor-pointer hover:bg-surface-gray-2"
					@click="saveHighLight(color)"
				>
					<span
						class="size-3 rounded-full"
						:style="{
							backgroundColor: theme.backgroundColor[color.toLowerCase()][400],
						}"
					></span>
					<span>
						{{ __(color) }}
					</span>
				</div>
			</div>
		</div>
		<div class="border-t">
			<div
				@click="addToNotes()"
				class="flex items-center space-x-2 hover:bg-surface-gray-2 cursor-pointer rounded-b-md py-2 px-3"
			>
				<NotepadText class="size-3 stroke-1.5" />
				<span>
					{{ __('Add to Notes') }}
				</span>
			</div>
			<div
				v-if="highlightExists()"
				@click="deleteHighlight"
				class="flex items-center space-x-2 hover:bg-surface-gray-2 cursor-pointer rounded-b-md py-2 px-3"
			>
				<Trash2 class="size-3 stroke-1.5" />
				<span>
					{{ __('Remove Highlight') }}
				</span>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { NotepadText, Trash2 } from 'lucide-vue-next'
import { theme } from '@/utils/theme'
import type { Note, Notes } from '@/components/Notes/types'
import { blockQuotesClick, highlightText } from '@/utils'

const user = inject<any>('$user')
const show = defineModel()
const notes = defineModel<Notes>('notes')
const top = ref(0)
const left = ref(0)
const currentSelection = ref<Selection | null>(null)
const selectedText = ref('')
const emit = defineEmits<{
	(e: 'updateNotes'): void
}>()

const props = defineProps<{
	lesson: string
}>()

watch(show, () => {
	if (!show.value) {
		return resetMenuPosition()
	}

	currentSelection.value = window.getSelection()
	if (!currentSelection.value?.toString()) {
		return resetMenuPosition()
	}

	updateMenuPosition()
})

const updateMenuPosition = () => {
	selectedText.value = currentSelection.value?.toString() || ''
	const range = currentSelection.value?.getRangeAt(0)
	const rect = range?.getBoundingClientRect()
	if (!rect) return

	const offsetY = window.scrollY
	const offsetX = window.scrollX

	top.value = Math.floor(rect.top + offsetY - 40)
	left.value = Math.floor(rect.right + offsetX + 10)
}

const resetMenuPosition = () => {
	top.value = 0
	left.value = 0
}

const colors = computed(() => {
	return ['Red', 'Blue', 'Green', 'Yellow', 'Purple']
})

const highlightExists = () => {
	return notes.value?.data?.some(
		(note: Note) => note.highlighted_text === selectedText.value
	)
}

const saveHighLight = (color: string) => {
	if (!selectedText.value) return

	notes.value?.insert.submit(
		{
			lesson: props.lesson,
			member: user?.data?.name,
			highlighted_text: selectedText.value,
			color: color,
			name: '',
		},
		{
			onSuccess(data: Note) {
				highlightText(data)
				resetStates()
				emit('updateNotes')
			},
			onError(err: any) {
				console.error('Error saving highlight:', err)
				resetStates()
			},
		}
	)
}

const deleteHighlight = () => {
	let notesToDelete = notes.value?.data.find(
		(note: Note) => note.highlighted_text === selectedText.value
	)
	if (!notesToDelete) return
	notes.value?.delete.submit(notesToDelete.name, {
		onSuccess() {
			resetStates()
			document.querySelectorAll('.highlighted-text').forEach((el) => {
				const element = el as HTMLElement
				if (element.dataset.name === notesToDelete.name) {
					element.style.backgroundColor = 'transparent'
				}
			})
		},
		onError(err: any) {
			console.error('Error deleting highlight:', err)
			resetStates()
		},
	})
}

const addToNotes = () => {
	if (!selectedText.value) return
	let noteToUpdate = notes.value?.data.find((note: Note) => {
		return !note.highlighted_text && note.note !== ''
	})
	if (!noteToUpdate) {
		createNote()
	} else {
		updateNote(noteToUpdate)
	}
}

const createNote = () => {
	notes.value?.insert.submit(
		{
			lesson: props.lesson,
			member: user?.data?.name,
			note: `<blockquote><p>${selectedText.value}</p></blockquote><br>`,
			color: 'Yellow',
			name: '',
		},
		{
			onSuccess(data: Note) {
				emit('updateNotes')
				setTimeout(() => {
					scrollToText(selectedText.value)
					blockQuotesClick()
					resetStates()
				}, 100)
			},
			onError(err: any) {
				console.error('Error creating note:', err)
				resetStates()
			},
		}
	)
}

const updateNote = (noteToUpdate: Note) => {
	notes.value?.setValue.submit(
		{
			name: noteToUpdate.name,
			note: `${noteToUpdate.note}\n\n<blockquote><p>${selectedText.value}</p></blockquote><br>`,
		},
		{
			onSuccess(data: Note) {
				emit('updateNotes')
				setTimeout(() => {
					scrollToText(selectedText.value)
					blockQuotesClick()
					resetStates()
				}, 100)
			},
			onError(err: any) {
				console.error('Error updating note:', err)
				resetStates()
			},
		}
	)
}

const scrollToText = (text: string) => {
	const elements = document.querySelectorAll('blockquote p')
	Array.from(elements).forEach((el) => {
		const element = el as HTMLElement
		if (element.textContent?.toLowerCase().includes(text.toLowerCase())) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}
	})
}

const resetStates = () => {
	selectedText.value = ''
	show.value = false
	resetMenuPosition()
}
</script>
