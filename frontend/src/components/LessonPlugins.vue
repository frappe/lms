<template>
	<div class="text-lg font-semibold">
		{{ __('Components') }}
	</div>
	<div class="mt-5">
		<Tooltip
			:text="
				__(
					'Content such as quiz, video and image will be added in the editor you select.'
				)
			"
			placement="bottom"
		>
			<div class="">
				<div class="text-xs text-gray-600 mb-1">
					{{ __('Select an Editor') }}
				</div>
				<Select v-model="currentEditor" :options="getEditorOptions()" />
			</div>
		</Tooltip>
		<div class="flex mt-4">
			<Link
				v-model="quiz"
				class="flex-1"
				doctype="LMS Quiz"
				:label="__('Select a Quiz')"
			/>
			<Button @click="addQuiz()" class="self-end ml-2">
				<template #icon>
					<Plus class="h-4 w-4 stroke-1.5" />
				</template>
			</Button>
		</div>
		<div class="mt-4">
			<div class="text-xs text-gray-600 mb-1">
				{{ __('Add an image, video, pdf or audio.') }}
			</div>
			<div class="flex">
				<FileUploader
					v-if="!file"
					:fileTypes="['image/*', 'video/*', 'audio/*', '.pdf']"
					:validateFile="validateFile"
					@success="(data) => addFile(data)"
				>
					<template v-slot="{ file, progress, uploading, openFileSelector }">
						<div class="">
							<Button @click="openFileSelector" :loading="uploading">
								{{
									uploading
										? __('Uploading {0}%').format(progress)
										: __('Upload a File')
								}}
							</Button>
						</div>
					</template>
				</FileUploader>
				<div v-else class="">
					<div class="flex items-center">
						<div class="border rounded-md p-2 mr-2">
							<FileText class="h-4 w-4 stroke-1.5 text-gray-700" />
						</div>
						<div class="flex flex-col">
							<span class="text-xs">
								{{ file.file_name }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="mt-4">
			<div class="text-xs text-gray-600 mb-1">
				{{
					__(
						'To add a YouTube video, paste the URL of the video in the editor.'
					)
				}}
			</div>
			<YouTubeExplanation>
				<template v-slot="{ togglePopover }">
					<div
						@click="togglePopover()"
						class="flex items-center text-sm underline cursor-pointer"
					>
						<Info class="w-3 h-3 stroke-1.5 text-gray-700 mr-1" />
						{{ __('Learn More') }}
					</div>
				</template>
			</YouTubeExplanation>
		</div>
	</div>
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import { FileUploader, Button, Select, Tooltip } from 'frappe-ui'
import { Plus, FileText, Info } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import YouTubeExplanation from '@/components/Modals/YouTubeExplanation.vue'

const quiz = ref(null)
const file = ref(null)
const lessonEditor = ref(null)
const instructorEditor = ref(null)
const currentEditor = ref('Lesson Content')

const props = defineProps({
	editor: {
		required: true,
	},
	notesEditor: {
		required: true,
	},
})

const addQuiz = () => {
	getCurrentEditor().caret.setToLastBlock('end', 0)
	if (quiz.value) {
		getCurrentEditor().blocks.insert('quiz', {
			quiz: quiz.value,
		})
		quiz.value = null
	}
}

const addFile = (data) => {
	getCurrentEditor().caret.setToLastBlock('end', 0)
	getCurrentEditor().blocks.insert('upload', data)
}

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png', 'mp4', 'mov', 'mp3', 'pdf'].includes(extension)) {
		return 'Only image and video files are allowed.'
	}
}

const getEditorOptions = () => {
	return [
		{
			label: 'Lesson Content',
			value: 'Lesson Content',
		},
		{
			label: 'Instructor Content',
			value: 'Instructor Content',
		},
	]
}

const getCurrentEditor = () => {
	return currentEditor.value == 'Lesson Content'
		? lessonEditor.value
		: instructorEditor.value
}

watch(
	() => [props.editor, props.notesEditor],
	([newEditor, newNotesEditor], [oldEditor, oldNotesEditor]) => {
		lessonEditor.value = newEditor
		instructorEditor.value = newNotesEditor
	}
)
</script>
