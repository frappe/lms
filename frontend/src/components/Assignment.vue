<template>
	<div
		v-if="assignment.data"
		class="grid grid-cols-2 h-full"
		:class="{ 'border rounded-lg overflow-auto': !showTitle }"
	>
		<div
			class="border-r p-5 overflow-y-auto h-[calc(100vh-3.2rem)]"
			:class="{ 'h-full': !showTitle }"
		>
			<div v-if="showTitle" class="text-lg font-semibold mb-5 text-ink-gray-9">
				<div v-if="submissionName === 'new'">
					{{ __('Submission by') }} {{ user.data?.full_name }}
				</div>
				<div v-else>
					{{ __('Submission by') }} {{ submissionResource.doc?.member_name }}
				</div>
			</div>
			<div class="text-sm text-ink-gray-7 font-medium mb-2">
				{{ __('Question') }}:
			</div>
			<div
				v-html="assignment.data.question"
				class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal"
			></div>
		</div>

		<div class="flex flex-col">
			<div class="p-5">
				<div class="flex items-center justify-between mb-4">
					<div class="font-semibold text-ink-gray-9">
						{{ __('Submission') }}
					</div>
					<div class="flex items-center space-x-2">
						<Badge v-if="isDirty" theme="orange">
							{{ __('Not Saved') }}
						</Badge>
						<Badge
							v-else-if="submissionResource.doc?.status"
							:theme="statusTheme"
							size="lg"
						>
							{{ submissionResource.doc?.status }}
						</Badge>
						<Button variant="solid" @click="submitAssignment()">
							{{ __('Save') }}
						</Button>
					</div>
				</div>
				<div
					v-if="
						submissionName != 'new' &&
						!['Pass', 'Fail'].includes(submissionResource.doc?.status) &&
						submissionResource.doc?.owner == user.data?.name
					"
					class="bg-surface-blue-2 text-ink-blue-2 p-3 rounded-md leading-5 text-sm mb-4"
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
					<div class="text-xs text-ink-gray-5 mt-1 mb-2">
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
						<div class="flex text-ink-gray-7">
							<div class="border self-start rounded-md p-2 mr-2">
								<FileText class="h-5 w-5 stroke-1.5" />
							</div>
							<a
								:href="submissionFile.file_url"
								target="_blank"
								class="flex flex-col cursor-pointer !no-underline"
							>
								<span class="text-sm leading-5">
									{{ submissionFile.file_name }}
								</span>
								<span class="text-sm text-ink-gray-5 mt-1">
									{{ getFileSize(submissionFile.file_size) }}
								</span>
							</a>
							<X
								v-if="canModifyAssignment"
								@click="removeSubmission()"
								class="bg-surface-gray-3 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
							/>
						</div>
					</div>
				</div>
				<div v-else-if="assignment.data.type == 'URL'">
					<div class="text-xs text-ink-gray-5 mb-1">
						{{ __('Enter a URL') }}
					</div>
					<FormControl
						v-model="answer"
						type="text"
						:readonly="!canModifyAssignment"
					/>
				</div>
				<div v-else>
					<div class="text-sm mb-2 text-ink-gray-7">
						{{ __('Write your answer here') }}
					</div>
					<TextEditor
						:content="answer"
						@change="(val) => (answer = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>

				<div
					v-if="
						user.data?.name == submissionResource.doc?.owner &&
						submissionResource.doc?.comments
					"
					class="mt-8 p-3 bg-surface-blue-2 rounded-md"
				>
					<div class="text-sm text-ink-gray-5 font-medium mb-2">
						{{ __('Comments by Evaluator') }}:
					</div>
					<div
						class="leading-5 text-ink-gray-9"
						v-html="submissionResource.doc.comments"
					></div>
				</div>

				<!-- Grading -->
				<div v-if="canGradeSubmission" class="mt-8 space-y-4">
					<div class="font-semibold mb-2 text-ink-gray-9">
						{{ __('Grading') }}
					</div>
					<FormControl
						v-if="submissionResource.doc"
						v-model="submissionResource.doc.status"
						:label="__('Grade')"
						type="select"
						:options="submissionStatusOptions"
					/>
					<div>
						<div class="text-sm text-ink-gray-5 mb-1">
							{{ __('Comments') }}
						</div>
						<TextEditor
							:content="comments"
							@change="
								(val) => {
									comments = val
									isDirty = true
								}
							"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Badge,
	Button,
	call,
	createResource,
	createDocumentResource,
	FileUploader,
	FormControl,
	TextEditor,
	toast,
} from 'frappe-ui'
import { computed, inject, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { FileText, X } from 'lucide-vue-next'
import { getFileSize } from '@/utils'
import { useRouter } from 'vue-router'

const submissionFile = ref(null)
const answer = ref(null)
const comments = ref(null)
const router = useRouter()
const user = inject('$user')
const isDirty = ref(false)

const props = defineProps({
	assignmentID: {
		type: String,
		required: true,
	},
	submissionName: {
		type: String,
		default: 'new',
	},
	showTitle: {
		type: Boolean,
		default: true,
	},
})

onMounted(() => {
	window.addEventListener('keydown', keyboardShortcut)
})

const keyboardShortcut = (e) => {
	if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
		submitAssignment()
		e.preventDefault()
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
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
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
	auto: false,
	cache: [user.data?.name, props.assignmentID],
})

watch(submissionResource, () => {
	if (submissionResource.doc) {
		if (submissionResource.doc.assignment_attachment) {
			imageResource.reload({
				image: submissionResource.doc.assignment_attachment,
			})
		}
		if (submissionResource.doc.answer) {
			answer.value = submissionResource.doc.answer
		}
		if (submissionResource.doc.comments) {
			comments.value = submissionResource.doc.comments
		}
		if (submissionResource.isDirty) {
			isDirty.value = true
		} else if (showUploader() && !submissionFile.value) {
			isDirty.value = true
		} else if (!showUploader() && !answer.value) {
			isDirty.value = true
		} else {
			isDirty.value = false
		}
	}
})

watch(submissionFile, () => {
	if (props.submissionName == 'new' && submissionFile.value) {
		isDirty.value = true
	}
})

const submitAssignment = () => {
	if (props.submissionName != 'new') {
		let evaluator =
			submissionResource.doc && submissionResource.doc.owner != user.data?.name
				? user.data?.name
				: null

		submissionResource.setValue.submit(
			{
				...submissionResource.doc,
				assignment_attachment: submissionFile.value?.file_url,
				evaluator: evaluator,
				comments: comments.value,
				answer: answer.value,
			},
			{
				onSuccess(data) {
					toast.success(__('Changes saved successfully'))
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
				toast.success(__('Assignment submitted successfully'))
				if (router.currentRoute.value.name == 'AssignmentSubmission') {
					router.push({
						name: 'AssignmentSubmission',
						params: {
							assignmentID: props.assignmentID,
							submissionName: data.name,
						},
						query: { fromLesson: router.currentRoute.value.query.fromLesson },
					})
				} else {
					markLessonProgress()
					router.go()
				}
				submissionResource.name = data.name
				submissionResource.reload()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const saveSubmission = (file) => {
	isDirty.value = true
	submissionFile.value = file
}

const markLessonProgress = () => {
	if (router.currentRoute.value.name == 'Lesson') {
		let courseName = router.currentRoute.value.params.courseName
		let chapterNumber = router.currentRoute.value.params.chapterNumber
		let lessonNumber = router.currentRoute.value.params.lessonNumber

		call('lms.lms.api.mark_lesson_progress', {
			course: courseName,
			chapter_number: chapterNumber,
			lesson_number: lessonNumber,
		})
	}
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
	isDirty.value = true
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

const canModifyAssignment = computed(() => {
	return (
		!submissionResource.doc ||
		(submissionResource.doc?.owner == user.data?.name &&
			submissionResource.doc?.status == 'Not Graded')
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
