<template>
	<header
		class="flex justify-between sticky top-0 z-10 border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<Button variant="solid" @click="submitAssignment()">
			{{ __('Save') }}
		</Button>
	</header>
	<div class="container py-5">
		<div
			v-if="submissionResource.data"
			class="bg-blue-100 p-2 rounded-md leading-5 text-sm italic"
		>
			{{ __("You've successfully submitted the assignment.") }}
			{{
				__(
					"Once the moderator grades your submission, you'll find the details here."
				)
			}}
			{{ __('Feel free to make edits to your submission if needed.') }}
		</div>
		<div v-if="assignment.data">
			<div>
				<div class="text-xl font-semibold hidden">
					{{ __('Question') }}
				</div>
				<div class="text-sm mt-1 hidden">
					{{
						__('Read the question carefully before attempting the assignment.')
					}}
				</div>
				<div
					v-html="assignment.data.question"
					class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal"
				></div>
			</div>
			<div class="">
				<div class="text-xl font-semibold mt-10">
					{{ __('Submission') }}
				</div>
				<div v-if="showUploader()">
					<div class="text-sm mt-1 mb-4">
						{{ __('Add your assignment as {0}').format(assignment.data.type) }}
					</div>
					<FileUploader
						v-if="!submissionFile"
						:fileTypes="getType()"
						:validateFile="validateFile"
						@success="(file) => saveSubmission(file)"
					>
						<template
							#default="{
								file,
								uploading,
								progress,
								uploaded,
								message,
								error,
								total,
								success,
								openFileSelector,
							}"
						>
							<Button @click="openFileSelector" :loading="uploading">
								{{
									uploading
										? __('Uploading {0}%').format(progress)
										: __('Upload File')
								}}
							</Button>
						</template>
					</FileUploader>
					<div v-else>
						<div class="flex items-center">
							<div class="border rounded-md p-2 mr-2">
								<FileText class="h-5 w-5 stroke-1.5 text-gray-700" />
							</div>
							<div class="flex flex-col">
								<span>
									{{ submissionFile.file_name }}
								</span>
								<span class="text-sm text-gray-500 mt-1">
									{{ getFileSize(submissionFile.file_size) }}
								</span>
							</div>
							<X
								@click="removeSubmission()"
								class="bg-gray-200 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
							/>
						</div>
					</div>
				</div>
				<div v-else-if="assignment.data.type == 'URL'">
					<div class="text-sm mb-4">
						{{ __('Enter a URL') }}
					</div>
					<FormControl v-model="answer" />
				</div>
				<div v-else>
					<div class="text-sm mb-4">
						{{ __('Write your answer here') }}
					</div>
					<TextEditor
						:content="answer"
						@change="(val) => (answer = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x bg-gray-100 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	createResource,
	FileUploader,
	Button,
	FormControl,
	TextEditor,
} from 'frappe-ui'
import { FileText, X } from 'lucide-vue-next'
import { computed, inject, onMounted, ref } from 'vue'
import { showToast, getFileSize } from '../utils'
import { useRouter } from 'vue-router'

const user = inject('$user')
const submissionFile = ref(null)
const answer = ref(null)
const router = useRouter()

const props = defineProps({
	assignmentName: {
		type: String,
		required: true,
	},
	submissionName: {
		type: String,
		default: 'new',
	},
})

const assignment = createResource({
	url: 'frappe.client.get',
	params: {
		doctype: 'LMS Assignment',
		name: props.assignmentName,
	},
	auto: true,
})

const showUploader = () => {
	return ['PDF', 'Image', 'Document'].includes(assignment.data?.type)
}

const updateSubmission = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		let fieldname = {}
		if (showUploader()) {
			fieldname.assignment_attachment = submissionFile.value.file_url
		} else {
			fieldname.answer = answer.value
		}
		return {
			doctype: 'LMS Assignment Submission',
			name: props.submissionName,
			fieldname: fieldname,
		}
	},
})

const imageResource = createResource({
	url: 'lms.lms.api.get_file_info',
	makeParams(values) {
		return {
			file_url: values.image,
		}
	},
	auto: false,
	onSuccess(data) {
		submissionFile.value = data
	},
})

const newSubmission = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		let doc = {
			doctype: 'LMS Assignment Submission',
			assignment: props.assignmentName,
			member: user.data?.name,
		}
		if (showUploader()) {
			doc.assignment_attachment = submissionFile.value.file_url
		} else {
			doc.answer = answer.value
		}
		return {
			doc: doc,
		}
	},
})

const submissionResource = createResource({
	url: 'frappe.client.get_value',
	params: {
		doctype: 'LMS Assignment Submission',
		fieldname: showUploader() ? 'assignment_attachment' : 'answer',
		filters: {
			name: props.submissionName,
		},
	},
	onSuccess(data) {
		if (data.assignment_attachment)
			imageResource.reload({ image: data.assignment_attachment })
		if (data.answer) answer.value = data.answer
	},
})
onMounted(() => {
	if (!user.data) {
		window.location.href = '/login'
	}
	if (props.submissionName != 'new') {
		submissionResource.reload()
	}
})

const submitAssignment = () => {
	if (props.submissionName != 'new') {
		updateSubmission.submit(
			{},
			{
				onSuccess(data) {
					showToast('Success', 'Submission updated successfully.', 'check')
				},
				onError(err) {
					showToast('Error', err.messages?.[0] || err, 'x')
				},
			}
		)
	} else {
		addNewSubmission()
	}
}

const addNewSubmission = () => {
	newSubmission.submit(
		{},
		{
			onSuccess(data) {
				showToast('Success', 'Assignment submitted successfully.', 'check')
				router.push({
					name: 'AssignmentSubmission',
					params: {
						assignmentName: props.assignmentName,
						submissionName: data.name,
					},
				})
			},
			onError(err) {
				showToast('Error', err.messages?.[0] || err, 'x')
			},
		}
	)
}

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'Assignment',
		},
		{
			label: assignment.data?.title,
			route: {
				name: 'AssignmentSubmission',
				params: {
					assignmentName: assignment.data?.name,
				},
			},
		},
	]
	return crumbs
})

const saveSubmission = (file) => {
	submissionFile.value = file
}

const getType = () => {
	const type = assignment.data?.type
	if (type == 'Image') {
		return ['image/*']
	} else if (type == 'Document') {
		return [
			'.doc',
			'.docx',
			'.xml',
			'application/msword',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		]
	} else if (type == 'PDF') {
		return ['.pdf']
	}
}

const validateFile = (file) => {
	let type = assignment.data?.type
	let extension = file.name.split('.').pop().toLowerCase()
	if (type == 'Image' && !['jpg', 'jpeg', 'png'].includes(extension)) {
		return 'Only image file is allowed.'
	} else if (
		type == 'Document' &&
		!['doc', 'docx', 'xml'].includes(extension)
	) {
		return 'Only document file is allowed.'
	} else if (type == 'PDF' && !['pdf'].includes(extension)) {
		return 'Only PDF file is allowed.'
	}
}

const removeSubmission = () => {
	submissionFile.value = null
}
</script>
