<template>
	<FileUploader
		:fileTypes="['image/*', 'video/*', 'audio/*', '.pdf']"
		:private="true"
		v-bind="attachArgs"
		:validateFile="validateFile"
		@success="(data) => addFile(data)"
		v-slot="{ openFileSelector, uploading, progress, error }"
	>
		<div>
			<AutoOpen :open="openFileSelector" />
			<Button :loading="uploading" @click="openFileSelector">
				{{
					uploading ? __('Uploading {0}%').format(progress) : __('Upload File')
				}}
			</Button>
			<ErrorMessage :message="error ?? undefined" class="mt-1" />
		</div>
	</FileUploader>
</template>
<script setup>
import { Button, ErrorMessage, FileUploader } from 'frappe-ui'
import { nextTick, computed } from 'vue'

const AutoOpen = {
	props: { open: { type: Function, required: true } },
	async mounted() {
		await nextTick()
		this.open()
	},
	render: () => null,
}

const props = defineProps({
	onFileUploaded: {
		type: Function,
		required: true,
	},
	uploadContext: {
		type: Object,
		default: () => ({}),
	},
})

// Attach to the lesson only once it exists: a null docname with doctype set
// makes the File doctype reject the upload. Uploads are always private
// (course lesson attachments, not public course media).
const attachArgs = computed(() => {
	const docname = props.uploadContext?.docname
	if (!docname) return {}
	return {
		doctype: 'Course Lesson',
		docname,
		fieldname: props.uploadContext?.fieldname || 'content',
	}
})

const addFile = (file) => {
	props.onFileUploaded({
		file_url: file.file_url,
		file_type: file.file_type,
	})
}

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png', 'mp4', 'mov', 'mp3', 'pdf'].includes(extension)) {
		return __('Only image and video files are allowed.')
	}
}

const isVideo = (type) => {
	return ['mov', 'mp4', 'avi', 'mkv', 'webm'].includes(type.toLowerCase())
}

const isAudio = (type) => {
	return ['mp3', 'wav', 'ogg'].includes(type.toLowerCase())
}
</script>
