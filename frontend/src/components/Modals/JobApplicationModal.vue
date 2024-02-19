<template>
	<Dialog
		:options="{
			title: __('Apply for this job'),
			size: '2xl',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => submitResume(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div>
					<div class="mb-1.5 text-sm text-gray-600">
						{{ __('Title') }}
					</div>
					<FileUploader
						:fileTypes="['pdf']"
						:validateFile="validateFile"
						@success="(file) => (resume.value = file.file_url)"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FileUploader } from 'frappe-ui'

const props = defineProps({
	email: {
		type: String,
		required: true,
	},
})

const resume = ref(null)

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (extension != 'pdf') {
		return 'Only PDF file is allowed'
	}
}
</script>
