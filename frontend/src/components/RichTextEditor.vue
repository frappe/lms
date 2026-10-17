<template>
	<Editor
		ref="editorRef"
		v-model="html"
		:extensions="extensions"
		:editable="editable"
		:placeholder="placeholder"
		:upload-function="uploadFile"
		format="html"
		@focus="hasFocus = true"
		@blur="onBlur"
	>
		<template #default>
			<EditorFixedMenu
				v-if="fixedMenu"
				class="w-full flex-wrap rounded-t-5 border border-outline-elevation-2 p-1"
				:class="menuClass"
				:items="toolbar"
			/>
			<EditorContent
				:id="id"
				:class="editorClass"
				:aria-labelledby="ariaLabelledby"
				:aria-required="
					ariaRequired === undefined ? undefined : String(ariaRequired)
				"
				:aria-invalid="
					ariaInvalid === undefined ? undefined : String(ariaInvalid)
				"
			/>
		</template>
	</Editor>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { useFileUpload } from 'frappe-ui'
import type { UploadOptions } from 'frappe-ui'
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
import type { MentionSuggestionItem, UploadFunction } from 'frappe-ui/editor'

const props = withDefaults(
	defineProps<{
		content?: string | null
		editable?: boolean
		fixedMenu?: boolean
		menuClass?: string
		editorClass?: string
		placeholder?: string
		mentions?: MentionSuggestionItem[] | null
		uploadArgs?: Pick<
			UploadOptions,
			'private' | 'folder' | 'doctype' | 'docname' | 'fieldname'
		>
		id?: string
		ariaLabelledby?: string
		ariaRequired?: boolean
		ariaInvalid?: boolean
	}>(),
	{
		content: '',
		editable: true,
		fixedMenu: false,
		menuClass: '',
		editorClass: 'prose-sm',
		placeholder: '',
		mentions: null,
		uploadArgs: undefined,
		id: undefined,
		ariaLabelledby: undefined,
		ariaRequired: undefined,
		ariaInvalid: undefined,
	}
)

const emit = defineEmits<{
	change: [value: string]
	blur: [event: FocusEvent]
}>()

const editorRef = useTemplateRef<InstanceType<typeof Editor>>('editorRef')

defineExpose({
	focus: () => editorRef.value?.editor?.commands.focus('end'),
})

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

// Editor reads extensions once at setup. The items getter lets a mention
// list that loads later reach the @ menu.
const extensions = [
	RichTextKit.configure({
		mention: props.mentions ? { items: () => props.mentions ?? [] } : false,
	}),
]

// Uploads default to private so editor images are not served from the
// unauthenticated /files/ path.
const fileUpload = useFileUpload()

const uploadFile: UploadFunction = (file, options) =>
	fileUpload.upload(file, {
		private: true,
		...props.uploadArgs,
		signal: options?.signal,
		onProgress: options?.onProgress,
	})

const html = ref(props.content ?? '')
const hasFocus = ref(false)

function onBlur(event: FocusEvent) {
	hasFocus.value = false
	emit('blur', event)
}

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
