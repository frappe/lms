<template>
	<Dialog
		v-model="show"
		class="text-base"
		:options="{
			title: __('Apply for this job'),
			size: 'lg',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => {
						submitResume(close)
					},
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<p>
					{{
						__(
							'Submit your resume to proceed with your application for this position. Upon submission, it will be shared with the job poster.'
						)
					}}
				</p>
				<div v-if="!resume">
					<FileUploader
						:fileTypes="['.pdf']"
						:validateFile="validateFile"
						@success="
							(file) => {
								resume = file
							}
						"
					>
						<template v-slot="{ file, progress, uploading, openFileSelector }">
							<div class="">
								<Button @click="openFileSelector" :loading="uploading">
									{{
										uploading ? `Uploading ${progress}%` : 'Upload your resume'
									}}
								</Button>
							</div>
						</template>
					</FileUploader>
				</div>
				<div v-else class="flex items-center">
					<div class="border rounded-md p-2 mr-2">
						<FileText class="h-5 w-5 stroke-1.5 text-ink-gray-7" />
					</div>
					<div class="flex flex-col">
						<span>
							{{ resume.file_name }}
						</span>
						<span class="text-sm text-ink-gray-4 mt-1">
							{{ getFileSize(resume.file_size) }}
						</span>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FileUploader, Button, createResource, toast } from 'frappe-ui'
import { FileText } from 'lucide-vue-next'
import { ref, inject } from 'vue'
import { getFileSize } from '@/utils/'

const resume = ref(null)
const show = defineModel()
const user = inject('$user')
const application = defineModel('application')

const props = defineProps({
	job: {
		type: String,
		required: true,
	},
})

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (extension != 'pdf') {
		return 'Only PDF file is allowed'
	}
}

const jobApplication = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Job Application',
				user: user.data?.name,
				resume: resume.value?.file_name,
				job: props.job,
			},
		}
	},
})

const submitResume = (close) => {
	jobApplication.submit(
		{},
		{
			validate() {
				if (!resume.value) {
					return 'Please upload your resume'
				}
			},
			onSuccess() {
				toast.success('Your application has been submitted successfully')
				application.value.reload()
				close()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}
</script>
