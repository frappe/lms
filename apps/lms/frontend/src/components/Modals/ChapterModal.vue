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
			<div class="space-y-4 text-base">
				<FormControl label="Title" v-model="chapter.title" :required="true" />
				<Switch
					size="sm"
					:label="__('SCORM Package')"
					:description="
						__(
							'Enable this only if you want to upload a SCORM package as a chapter.'
						)
					"
					v-model="chapter.is_scorm_package"
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
										uploading ? `Uploading ${progress}%` : 'Upload an ZIP file'
									}}
								</Button>
							</div>
						</template>
					</FileUploader>
					<div v-else class="">
						<div class="flex items-center">
							<div class="border rounded-md p-2 mr-2">
								<FileText class="h-5 w-5 stroke-1.5 text-ink-gray-7" />
							</div>
							<div class="flex flex-col">
								<span>
									{{ chapter.scorm_package.file_name }}
								</span>
								<span class="text-sm text-ink-gray-4 mt-1">
									{{ getFileSize(chapter.scorm_package.file_size) }}
								</span>
							</div>
							<X
								@click="() => (chapter.scorm_package = null)"
								class="bg-surface-gray-3 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
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
	Switch,
	toast,
} from 'frappe-ui'
import { reactive, watch, inject } from 'vue'
import { getFileSize } from '@/utils/'
import { capture } from '@/telemetry'
import { FileText, X } from 'lucide-vue-next'
import { useOnboarding } from 'frappe-ui/frappe'

const show = defineModel()
const outline = defineModel('outline')
const user = inject('$user')
const { updateOnboardingStep } = useOnboarding('learning')

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
	url: 'lms.lms.api.upsert_chapter',
	makeParams(values) {
		return {
			title: chapter.title,
			course: props.course,
			is_scorm_package: chapter.is_scorm_package,
			scorm_package: chapter.scorm_package,
			name: props.chapterDetail?.name,
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
				return validateChapter()
			},
			onSuccess: (data) => {
				if (user.data?.is_system_manager)
					updateOnboardingStep('create_first_chapter')

				capture('chapter_created')
				chapterReference.submit(
					{ name: data.name },
					{
						onSuccess(data) {
							cleanChapter()
							outline.value.reload()
							toast.success(__('Chapter added successfully'))
						},
						onError(err) {
							toast.error(err.messages?.[0] || err)
						},
					}
				)
				close()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const validateChapter = () => {
	if (!chapter.title) {
		return __('Title is required')
	}
	if (chapter.is_scorm_package && !chapter.scorm_package) {
		return __('Please upload a SCORM package')
	}
}

const cleanChapter = () => {
	chapter.title = ''
	chapter.is_scorm_package = 0
	chapter.scorm_package = null
}

const editChapter = (close) => {
	chapterResource.submit(
		{},
		{
			validate() {
				if (!chapter.title) {
					return 'Title is required'
				}
			},
			onSuccess() {
				outline.value.reload()
				toast.success(__('Chapter updated successfully'))
				close()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

watch(
	() => props.chapterDetail,
	(newChapter) => {
		chapter.title = newChapter?.title
		chapter.is_scorm_package = newChapter?.is_scorm_package
		chapter.scorm_package = newChapter?.scorm_package
	}
)

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (extension !== 'zip') {
		return __('Only zip files are allowed')
	}
}
</script>
