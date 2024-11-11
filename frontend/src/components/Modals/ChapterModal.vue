<template>
	<Dialog
		v-model="show"
		:options="{
			title: chapterDetail ? __('Edit Chapter') : __('Add Chapter'),
			size: 'lg',
			actions: [
				{
					label: chapterDetail ? __('Edit') : __('Create'),
					variant: 'solid',
					onClick: (close) =>
						chapterDetail ? editChapter(close) : addChapter(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4">
				<FormControl ref="chapterInput" label="Title" v-model="chapter.title" />
				<FormControl
					:label="__('Is SCORM Package')"
					v-model="chapter.is_scorm_package"
					type="checkbox"
				/>
				<div v-if="chapter.is_scorm_package">
					<FileUploader
						v-if="!chapter.scorm_package"
						:fileTypes="['.zip']"
						:validateFile="validateFile"
						@success="(file) => (chapter.scorm_package = file)"
					>
						<template v-slot="{ file, progress, uploading, openFileSelector }">
							<div class="mb-4">
								<Button @click="openFileSelector" :loading="uploading">
									{{
										uploading ? `Uploading ${progress}%` : 'Upload an zip file'
									}}
								</Button>
							</div>
						</template>
					</FileUploader>
					<div v-else class="">
						<div class="flex items-center">
							<div class="border rounded-md p-2 mr-2">
								<FileText class="h-5 w-5 stroke-1.5 text-gray-700" />
							</div>
							<div class="flex flex-col">
								<span>
									{{ chapter.scorm_package.file_name }}
								</span>
								<span class="text-sm text-gray-500 mt-1">
									{{ getFileSize(chapter.scorm_package.file_size) }}
								</span>
							</div>
							<X
								@click="() => (chapter.scorm_package = null)"
								class="bg-gray-200 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Button,
	createResource,
	Dialog,
	FileUploader,
	FormControl,
} from 'frappe-ui'
import { defineModel, reactive, watch, ref } from 'vue'
import { showToast, getFileSize } from '@/utils/'
import { capture } from '@/telemetry'
import { FileText, X } from 'lucide-vue-next'

const show = defineModel()
const outline = defineModel('outline')
const chapterInput = ref(null)

const props = defineProps({
	course: {
		type: String,
		required: true,
	},
	chapterDetail: {
		type: Object,
	},
})

const chapter = reactive({
	title: '',
	is_scorm_package: 0,
	scorm_package: null,
})

const chapterResource = createResource({
	url: 'lms.lms.api.add_chapter',
	makeParams(values) {
		return {
			title: chapter.title,
			course: props.course,
			is_scorm_package: chapter.is_scorm_package,
			scorm_package: chapter.scorm_package,
		}
	},
})

const chapterEditResource = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'Course Chapter',
			name: props.chapterDetail?.name,
			fieldname: 'title',
			value: chapter.title,
		}
	},
})

const chapterReference = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Chapter Reference',
				chapter: values.name,
				parent: props.course,
				parenttype: 'LMS Course',
				parentfield: 'chapters',
			},
		}
	},
})

const addChapter = async (close) => {
	chapterResource.submit(
		{},
		{
			validate() {
				if (!chapter.title) {
					return __('Title is required')
				}
				if (chapter.is_scorm_package && !chapter.scorm_package) {
					return __('Please upload a SCORM package')
				}
			},
			onSuccess: (data) => {
				capture('chapter_created')
				chapterReference.submit(
					{ name: data.name },
					{
						onSuccess(data) {
							cleanChapter()
							outline.value.reload()
							showToast(
								__('Success'),
								__('Chapter added successfully'),
								'check'
							)
						},
						onError(err) {
							showToast(__('Error'), err.messages?.[0] || err, 'x')
						},
					}
				)
				close()
			},
			onError(err) {
				showToast(__('Error'), err.messages?.[0] || err, 'x')
			},
		}
	)
}

const cleanChapter = () => {
	chapter.title = ''
	chapter.is_scorm_package = 0
	chapter.scorm_package = null
}

const editChapter = (close) => {
	chapterEditResource.submit(
		{},
		{
			validate() {
				if (!chapter.title) {
					return 'Title is required'
				}
			},
			onSuccess() {
				outline.value.reload()
				showToast(__('Success'), __('Chapter updated successfully'), 'check')
				close()
			},
			onError(err) {
				showToast(__('Error'), err.messages?.[0] || err, 'x')
			},
		}
	)
}

watch(
	() => props.chapterDetail,
	(newChapter) => {
		chapter.title = newChapter?.title
	}
)

/* watch(show, () => {
	if (show.value) {
		setTimeout(() => {
			chapterInput.value.$el.querySelector('input').focus()
		}, 100)
	}
}) */

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (extension !== 'zip') {
		return __('Only zip files are allowed')
	}
}
</script>
