<template>
	<div data-testid="rich-text-editor" :class="boxClasses">
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
					:class="toolbarClasses"
					:items="toolbar"
				/>
				<EditorContent
					:id="id"
					:class="[
						editorClass,
						contentClasses,
						'focus-visible:ring-2 focus-visible:ring-outline-gray-5',
					]"
					:aria-label="ariaLabel"
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
	</div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
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
import {
	boxClass,
	contentClass,
	toolbarClass,
} from '@/components/richTextEditorClasses'
import type {
	RichTextEditorMaxHeight,
	RichTextEditorMinHeight,
	RichTextEditorVariant,
} from '@/components/richTextEditorClasses'

const props = withDefaults(
	defineProps<{
		content?: string | null
		editable?: boolean
		fixedMenu?: boolean
		variant?: RichTextEditorVariant
		minHeight?: RichTextEditorMinHeight | null
		maxHeight?: RichTextEditorMaxHeight | null
		fill?: boolean
		editorClass?: string
		placeholder?: string
		mentions?: MentionSuggestionItem[] | null
		uploadArgs?: Pick<
			UploadOptions,
			'private' | 'folder' | 'doctype' | 'docname' | 'fieldname'
		>
		id?: string
		ariaLabel?: string
		ariaLabelledby?: string
		ariaRequired?: boolean
		ariaInvalid?: boolean
	}>(),
	{
		content: '',
		editable: true,
		fixedMenu: false,
		variant: 'outline',
		minHeight: null,
		maxHeight: null,
		fill: false,
		editorClass: 'prose-sm',
		placeholder: '',
		mentions: null,
		uploadArgs: undefined,
		id: undefined,
		ariaLabel: undefined,
		ariaLabelledby: undefined,
		ariaRequired: undefined,
		ariaInvalid: undefined,
	}
)

const emit = defineEmits<{
	change: [value: string]
	blur: [event: FocusEvent]
}>()

const boxClasses = computed(() =>
	boxClass(props.variant, props.ariaInvalid === true, props.fill)
)
const toolbarClasses = computed(() => toolbarClass(props.variant))
const contentClasses = computed(() =>
	contentClass(props.variant, props.minHeight, props.maxHeight, props.fill)
)

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
