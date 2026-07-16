<template>
	<Editor
		v-model="html"
		:extensions="extensions"
		:editable="editable"
		:placeholder="placeholder"
		:upload-function="uploadFile"
		format="html"
		@focus="hasFocus = true"
		@blur="hasFocus = false"
	>
		<template #default>
			<EditorFixedMenu
				v-if="fixedMenu"
				class="w-full overflow-x-auto rounded-t-lg border border-outline-elevation-2"
				:items="toolbar"
			/>
			<EditorContent :class="editorClass" />
		</template>
	</Editor>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFileUpload } from 'frappe-ui'
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Blockquote,
	Bold,
	BulletList,
	Editor,
	EditorContent,
	EditorFixedMenu,
	FontColor,
	HeadingGroup,
	HorizontalRule,
	InlineCode,
	InsertIframe,
	InsertImage,
	InsertLink,
	InsertTable,
	InsertVideo,
	Italic,
	OrderedList,
	Redo,
	RichTextKit,
	Separator,
	Strike,
	Undo,
} from 'frappe-ui/editor'

type Mention = { value: string; label: string }

const props = withDefaults(
	defineProps<{
		content?: string | null
		editable?: boolean
		fixedMenu?: boolean
		editorClass?: string
		placeholder?: string
		mentions?: Mention[] | null
		uploadArgs?: Record<string, unknown>
	}>(),
	{
		content: '',
		editable: true,
		fixedMenu: false,
		editorClass: 'prose-sm',
		placeholder: '',
		mentions: null,
		uploadArgs: undefined,
	}
)

const emit = defineEmits<{ change: [value: string] }>()

const toolbar = [
	HeadingGroup,
	Separator,
	Bold,
	Italic,
	Strike,
	InsertLink,
	FontColor,
	Separator,
	BulletList,
	OrderedList,
	Separator,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Separator,
	InsertImage,
	InsertVideo,
	Blockquote,
	InlineCode,
	InsertIframe,
	Separator,
	HorizontalRule,
	InsertTable,
	Separator,
	Undo,
	Redo,
]

const extensions = computed(() => [
	RichTextKit.configure({
		mention: props.mentions
			? {
					items: props.mentions.map((m) => ({
						id: m.value,
						label: m.label,
					})),
			  }
			: false,
	}),
])

// Uploads default to private so editor images are not served from the
// unauthenticated /files/ path — the default the old TextEditor applied.
const fileUpload = useFileUpload()

function uploadFile(file: File) {
	return fileUpload.upload(file, {
		private: true,
		...(props.uploadArgs || {}),
	})
}

const html = ref(props.content ?? '')
const hasFocus = ref(false)

watch(
	() => props.content,
	(value) => {
		if (hasFocus.value) return
		if ((value ?? '') !== html.value) html.value = value ?? ''
	}
)

watch(html, (value) => {
	if (value !== (props.content ?? '')) emit('change', value)
})
</script>
