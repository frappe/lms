<template>
	<div v-if="assignment.data" class="grid grid-cols-2 gap-5">
		<div class="p-5 border rounded-md overflow-y-auto h-[calc(100vh-6rem)]">
			<div class="font-medium mb-2">
				{{ __('Question') }}
			</div>
			<div
				v-html="assignment.data.question"
				class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal"
			></div>
		</div>

		<div class="flex flex-col">
			<div class="p-5 border rounded-md">
				<div class="flex items-center justify-between mb-4">
					<div class="font-medium">
						{{ __('Submission') }}
					</div>
					<div class="flex items-center space-x-2">
						<Badge
							v-if="submissionResource.doc?.status || !submissionResource.doc"
							:theme="statusTheme"
							size="lg"
						>
							{{ submissionResource.doc?.status || 'Not Saved' }}
						</Badge>
						<Button variant="solid" @click="submitAssignment()">
							{{ __('Save') }}
						</Button>
					</div>
				</div>
				<div
					v-if="submissionName != 'new'"
					class="bg-blue-100 p-2 rounded-md leading-5 text-sm mb-4"
				>
					{{ __("You've successfully submitted the assignment.") }}
					{{
						__(
							"Once the moderator grades your submission, you'll find the details here."
						)
					}}
					{{ __('Feel free to make edits to your submission if needed.') }}
				</div>
				<div v-if="showUploader()">
					<div class="text-xs text-gray-600 mt-1 mb-2">
						{{ __('Add your assignment as {0}').format(assignment.data.type) }}
					</div>
					<FileUploader
						v-if="!submissionFile"
						:fileTypes="getType()"
						:validateFile="validateFile"
						@success="(file) => saveSubmission(file)"
					>
						<template #default="{ uploading, progress, openFileSelector }">
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
								v-if="
									!submissionResource.doc ||
									submissionResource.doc?.owner == user.data?.name
								"
								@click="removeSubmission()"
								class="bg-gray-200 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
							/>
						</div>
					</div>
				</div>
				<div v-else-if="assignment.data.type == 'URL'" class="mt-5">
					<div class="text-xs text-gray-600 mb-1">
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
			<!-- Grading -->
			<div
				v-if="canGradeSubmission"
				class="p-3 border rounded-md mt-5 space-y-4"
			>
				<div class="text-sm text-gray-600 font-medium mb-5">
					{{ __('Grading') }}
				</div>
				<FormControl
					v-if="submissionResource.doc"
					v-model="submissionResource.doc.status"
					:label="__('Grade')"
					type="select"
					:options="submissionStatusOptions"
				/>
				<FormControl
					v-if="submissionResource.doc"
					v-model="submissionResource.doc.comments"
					:label="__('Comments')"
					type="textarea"
				/>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Badge,
	Button,
	createResource,
	createDocumentResource,
	FileUploader,
	FormControl,
	TextEditor,
} from 'frappe-ui'
import { computed, inject, ref } from 'vue'
import { FileText, X } from 'lucide-vue-next'
import { showToast, getFileSize } from '@/utils'
import { useRouter } from 'vue-router'

const submissionFile = ref(null)
const answer = ref(null)
const router = useRouter()
const user = inject('$user')

const props = defineProps({
	assignmentID: {
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
		name: props.assignmentID,
	},
	auto: true,
	onSuccess(data) {
		if (props.submissionName != 'new') {
			submissionResource.reload()
		}
	},
})

const newSubmission = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		let doc = {
			doctype: 'LMS Assignment Submission',
			assignment: props.assignmentID,
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

const submissionResource = createDocumentResource({
	doctype: 'LMS Assignment Submission',
	name: props.submissionName,
	auto: false,
	onSuccess(data) {
		if (data.assignment_attachment) {
			imageResource.reload({ image: data.assignment_attachment })
		}
	},
})

const submitAssignment = () => {
	if (props.submissionName != 'new') {
		let evaluator =
			submissionResource.doc && submissionResource.doc.owner != user.data?.name
				? user.data?.name
				: null
		submissionResource.setValue.submit({
			...submissionResource.doc,
			evaluator: evaluator,
		})
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
				if (router.currentRoute.value.name == 'AssignmentSubmission') {
					router.push({
						name: 'AssignmentSubmission',
						params: {
							assignmentID: props.assignmentID,
							submissionName: data.name,
						},
					})
				} else {
					router.go()
				}
			},
			onError(err) {
				showToast('Error', err.messages?.[0] || err, 'x')
			},
		}
	)
}

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

const canGradeSubmission = computed(() => {
	return (
		(user.data?.is_moderator ||
			user.data?.is_evaluator ||
			user.data?.is_instructor) &&
		props.submissionName != 'new' &&
		router.currentRoute.value.name == 'AssignmentSubmission'
	)
})

const submissionStatusOptions = computed(() => {
	return [
		{ label: 'Not Graded', value: 'Not Graded' },
		{ label: 'Pass', value: 'Pass' },
		{ label: 'Fail', value: 'Fail' },
	]
})

const statusTheme = computed(() => {
	if (!submissionResource.doc) {
		return 'orange'
	} else if (submissionResource.doc.status == 'Pass') {
		return 'green'
	} else if (submissionResource.doc.status == 'Not Graded') {
		return 'blue'
	} else {
		return 'red'
	}
})

const showUploader = () => {
	return ['PDF', 'Image', 'Document'].includes(assignment.data?.type)
}
</script>
