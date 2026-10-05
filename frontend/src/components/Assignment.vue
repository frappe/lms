<template>
	<div v-if="assignment.data" ref="root" :class="rootClass">
		<div v-if="showTitle" class="mb-4 text-lg-semibold text-ink-gray-9">
			<div v-if="currentSubmission === 'new'">
				{{ __('Submission by') }} {{ user.data?.full_name }}
			</div>
			<div v-else>
				{{ __('Submission by') }} {{ submissionDoc?.member_name }}
			</div>
		</div>
		<AssessmentCard>
			<AssessmentCardHeader
				icon="lucide-notebook-pen"
				:title="__('Assignment')"
				:subtitle="assignment.data.title"
			>
				<ShortcutTooltip
					v-if="
						(canModifyAssignment || canGradeSubmission) &&
						(!scheduleBlocked || canGradeSubmission)
					"
					:label="saveLabel"
					combo="Mod+S"
				>
					<Button
						variant="solid"
						size="sm"
						:loading="isSubmitting"
						:disabled="scheduleBlocked && !canGradeSubmission"
						@click="submitAssignment()"
					>
						{{ saveLabel }}
					</Button>
				</ShortcutTooltip>
			</AssessmentCardHeader>

			<div
				class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
			>
				<div
					class="min-w-0 space-y-2 border-b border-outline-gray-1 p-3.5 md:border-b-0 md:border-e"
				>
					<div class="text-sm text-ink-gray-5">{{ __('Brief') }}</div>
					<div
						v-safe-html:rich="assignment.data.question"
						class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal"
					></div>
				</div>

				<div class="flex min-w-0 flex-col">
					<div
						class="flex h-11 shrink-0 items-center justify-between gap-x-2 border-b border-outline-gray-1 bg-surface-gray-1 px-3.5"
					>
						<span class="text-sm text-ink-gray-7">{{ __('Submission') }}</span>
						<Badge v-if="isDirty" theme="amber" size="sm">
							{{ __('Not Saved') }}
						</Badge>
						<Badge
							v-else-if="submissionDoc?.status"
							:theme="statusTheme"
							size="sm"
						>
							{{ submissionDoc?.status }}
						</Badge>
					</div>

					<div class="space-y-3 p-3.5">
						<Alert
							v-if="scheduleBlocked"
							theme="amber"
							:title="scheduleMessage"
						/>
						<div
							v-if="showUploader() && canModifyAssignment && !scheduleBlocked"
						>
							<AssignmentUploadPrompt
								v-if="!attachment"
								:type="assignment.data.type"
							>
								<FileUploader
									:fileTypes="getType()"
									:private="true"
									:validateFile="
										(file) =>
											validateFile(
												file,
												true,
												(assignment.data?.type ?? '').toLowerCase()
											)
									"
									@success="(file) => saveSubmission(file)"
								>
									<template
										#default="{ uploading, progress, openFileSelector }"
									>
										<Button
											variant="outline"
											size="sm"
											:loading="uploading"
											@click="openFileSelector"
										>
											{{
												uploading
													? __('Uploading {0}%').format(progress)
													: __('Upload File')
											}}
										</Button>
									</template>
								</FileUploader>
							</AssignmentUploadPrompt>
							<div
								v-else
								data-testid="assignment-attachment"
								class="flex h-9 items-center gap-x-2 rounded-4 border border-outline-gray-2 px-2.5"
							>
								<span
									class="lucide-file-text size-4 shrink-0 text-ink-gray-6"
								/>
								<a
									:href="safeUrl(attachment)"
									v-external
									class="min-w-0 flex-1 truncate text-base text-ink-gray-8 !no-underline"
								>
									{{ attachment.split('/').pop() }}
								</a>
								<Button
									variant="ghost"
									size="sm"
									:aria-label="__('Remove submission')"
									@click="removeSubmission()"
								>
									<template #icon>
										<span class="lucide-x size-4" />
									</template>
								</Button>
							</div>
						</div>
						<div v-else-if="assignment.data.type == 'URL' && !scheduleBlocked">
							<FormControl
								v-model="answer"
								type="text"
								placeholder="https://"
								:label="__('Enter a URL')"
								:disabled="!canModifyAssignment"
							/>
						</div>
						<div v-else-if="!showUploader() && !scheduleBlocked">
							<InputLabel
								:id="answerLabelId"
								:label="__('Write your answer here')"
								class="mb-1.5"
							/>
							<RichTextEditor
								:ariaLabelledby="answerLabelId"
								:content="answer"
								@change="(val) => (answer = val)"
								:editable="canModifyAssignment"
								:fixedMenu="true"
								:uploadArgs="{
									private: true,
								}"
								minHeight="7rem"
							/>
						</div>

						<div
							v-if="
								currentSubmission != 'new' &&
								!['Pass', 'Fail'].includes(submissionDoc?.status ?? '') &&
								submissionDoc?.owner == user.data?.name
							"
							class="flex items-start gap-x-2"
						>
							<span
								class="lucide-circle-help mt-0.5 size-3.5 shrink-0 text-ink-gray-5"
							/>
							<p class="text-p-sm text-ink-gray-6">
								{{ __("You've successfully submitted the assignment.") }}
								{{
									__(
										"Once the moderator grades your submission, you'll find the details here."
									)
								}}
								{{
									__('Feel free to make edits to your submission if needed.')
								}}
							</p>
						</div>

						<div
							v-if="
								user.data?.name == submissionDoc?.owner &&
								submissionDoc?.comments
							"
							class="space-y-2 rounded-6 border border-outline-gray-2 bg-surface-gray-1 p-3"
						>
							<div class="text-sm text-ink-gray-5">
								{{ __('Comments by Evaluator') }}
							</div>
							<div
								class="text-p-base text-ink-gray-9"
								v-safe-html:rich="submissionDoc.comments"
							></div>
						</div>

						<div v-if="canGradeSubmission" class="space-y-4 pt-2">
							<div class="text-sm-semibold text-ink-gray-9">
								{{ __('Grading') }}
							</div>
							<FormControl
								v-if="submissionDoc"
								v-model="submissionDoc.status"
								:label="__('Grade')"
								type="select"
								:options="submissionStatusOptions"
							/>
							<div>
								<InputLabel
									:id="commentsLabelId"
									:label="__('Comments')"
									class="mb-1.5"
								/>
								<RichTextEditor
									:ariaLabelledby="commentsLabelId"
									:content="comments"
									@change="
										(val) => {
											comments = val
											isDirty = true
										}
									"
									:editable="true"
									:fixedMenu="true"
									:uploadArgs="{
										private: true,
									}"
									minHeight="7rem"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AssessmentCard>
	</div>
	<AssessmentCard
		v-else-if="assignment.loading"
		aria-busy="true"
		data-testid="assignment-skeleton"
	>
		<AssessmentCardHeader icon="lucide-notebook-pen" :title="__('Assignment')">
			<Skeleton class="h-7 w-16 rounded-4" />
		</AssessmentCardHeader>
		<div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
			<div
				class="space-y-2.5 border-b border-outline-gray-1 p-3.5 md:border-b-0 md:border-e"
			>
				<Skeleton class="h-4 w-12 rounded-4" />
				<Skeleton class="h-4 w-full rounded-4" />
				<Skeleton class="h-4 w-11/12 rounded-4" />
				<Skeleton class="h-4 w-4/5 rounded-4" />
				<Skeleton class="h-4 w-2/3 rounded-4" />
			</div>
			<div class="flex flex-col">
				<div
					class="flex h-11 items-center border-b border-outline-gray-1 bg-surface-gray-1 px-3.5"
				>
					<Skeleton class="h-4 w-20 rounded-4" />
				</div>
				<div class="p-3.5">
					<Skeleton class="h-32 w-full rounded-6" />
				</div>
			</div>
		</div>
	</AssessmentCard>
</template>
<script setup lang="ts">
import {
	Alert,
	Badge,
	Button,
	call,
	createResource,
	createDocumentResource,
	FileUploader,
	FormControl,
	Skeleton,
	toast,
} from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { InputLabel } from 'frappe-ui/experimental'
import { computed, inject, ref, shallowRef, useId, watch } from 'vue'
import AssessmentCard from '@/components/Assessment/AssessmentCard.vue'
import AssessmentCardHeader from '@/components/Assessment/AssessmentCardHeader.vue'
import AssignmentUploadPrompt from '@/components/Assessment/AssignmentUploadPrompt.vue'
import ShortcutTooltip from '@/components/ShortcutTooltip.vue'
import {
	sameBlock,
	saveShortcut,
	useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'
import router from '@/router'
import { validateFile } from '@/utils'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { safeUrl } from '@/utils/safeUrl'
import { useAssessmentSchedule } from '@/composables/useAssessmentSchedule'
import type { ScheduledAssessment } from '@/composables/useAssessmentSchedule'
import { markLessonProgress } from '@/utils/markLessonProgress'
import type { SessionUser } from '@/types'

type SubmissionStatus = 'Not Graded' | 'Pass' | 'Fail'

interface AssignmentDetails extends ScheduledAssessment {
	title: string
	question: string
	type: 'Document' | 'PDF' | 'URL' | 'Image' | 'Text'
}

interface SubmissionDoc {
	name: string
	owner: string
	member_name?: string
	status: SubmissionStatus
	answer?: string | null
	assignment_attachment?: string | null
	comments?: string | null
}

interface NewSubmission {
	doctype: 'LMS Assignment Submission'
	assignment: string
	member?: string
	answer?: string | null
	assignment_attachment?: string | null
}

const answer = ref<string | null>(null)
const attachment = ref<string | null>(null)
const comments = ref<string | null>(null)
const answerLabelId = useId()
const commentsLabelId = useId()
const user = inject<SessionUser>('$user')!
const isDirty = ref(false)

const props = withDefaults(
	defineProps<{
		assignmentID: string
		submissionName?: string
		showTitle?: boolean
		// Mounted inline in a lesson: no navigation, no grading, natural height.
		embedded?: boolean
	}>(),
	{
		submissionName: 'new',
		showTitle: true,
		embedded: false,
	}
)

// Starts as the prop and becomes the real name after the first save, so the
// next save updates it instead of inserting a duplicate (there is no route
// push to remount the card inline).
const currentSubmission = ref<string>(props.submissionName)
const root = ref<HTMLElement | null>(null)

const rootClass = computed<string>(() => {
	if (props.embedded) return ''
	return props.showTitle
		? 'h-full overflow-y-auto p-5'
		: 'h-full overflow-y-auto'
})

useKeyboardShortcuts({
	ignoreTyping: false,
	shortcuts: [
		{ ...saveShortcut(() => submitAssignment()), guard: sameBlock(root) },
	],
})

const assignment = createResource<AssignmentDetails>({
	url: 'lms.lms.utils.get_assignment',
	params: {
		name: props.assignmentID,
	},
	auto: true,
	onSuccess() {
		if (currentSubmission.value != 'new') {
			submissionResource.value?.reload()
		}
	},
})

const submissionFor = (name: string) =>
	createDocumentResource<SubmissionDoc>({
		doctype: 'LMS Assignment Submission',
		name,
		auto: false,
		onError(err: FrappeResourceError) {
			toast.error(err.messages?.[0] || err.message)
		},
	})

// frappe-ui caches document resources per name, so every card holding 'new'
// would share one. A resource exists only for a real name.
const submissionResource = shallowRef(
	props.submissionName === 'new' ? null : submissionFor(props.submissionName)
)
const submissionDoc = computed(() => submissionResource.value?.doc ?? null)

watch(
	submissionDoc,
	(doc) => {
		if (!doc) return
		if (doc.answer) answer.value = doc.answer
		if (doc.assignment_attachment) attachment.value = doc.assignment_attachment
		if (doc.comments) comments.value = doc.comments
	},
	{ deep: true }
)

const isSubmitting = ref(false)

const submitAssignment = () => {
	if (isSubmitting.value) return
	if (scheduleBlocked.value && !canGradeSubmission.value) {
		toast.error(scheduleMessage.value)
		return
	}
	isSubmitting.value = true

	if (currentSubmission.value != 'new') {
		updateSubmission()
	} else {
		addNewSubmission()
	}
}

const prepareSubmissionDoc = (): NewSubmission => {
	const doc: NewSubmission = {
		doctype: 'LMS Assignment Submission',
		assignment: props.assignmentID,
		member: user.data?.name,
	}
	if (!showUploader()) {
		doc.answer = answer.value
	} else {
		doc.assignment_attachment = attachment.value
	}
	return doc
}

const addNewSubmission = () => {
	const doc = prepareSubmissionDoc()
	if (!doc.assignment_attachment && !doc.answer) {
		toast.error(
			__('Please provide an answer or upload a file before submitting.')
		)
		isSubmitting.value = false
		return
	}
	call<{ name: string }>('frappe.client.insert', {
		doc: doc,
	})
		.then((data) => {
			toast.success(__('Assignment submitted successfully'))
			currentSubmission.value = data.name
			if (!props.embedded) {
				router.push({
					name: 'AssignmentSubmission',
					params: {
						assignmentID: props.assignmentID,
						submissionName: data.name,
					},
					query: { fromLesson: router.currentRoute.value.query.fromLesson },
				})
			}
			markLessonProgress()
			isDirty.value = false
			submissionResource.value = submissionFor(data.name)
			submissionResource.value.reload()
		})
		.catch((err: FrappeResourceError) => {
			toast.error(err.messages?.[0] || err.message)
			console.error(err)
		})
		.finally(() => {
			isSubmitting.value = false
		})
}

const updateSubmission = () => {
	const evaluator =
		submissionDoc.value && submissionDoc.value.owner != user.data?.name
			? user.data?.name
			: null

	submissionResource.value?.setValue.submit(
		{
			...submissionDoc.value,
			evaluator: evaluator,
			comments: comments.value,
			answer: answer.value,
			assignment_attachment: attachment.value,
		},
		{
			onSuccess() {
				isDirty.value = false
				isSubmitting.value = false
				toast.success(__('Changes saved successfully'))
			},
			onError(err: FrappeResourceError) {
				isSubmitting.value = false
				toast.error(err.messages?.[0] || err.message)
				console.error(err)
			},
		}
	)
}

const saveSubmission = (file: { file_url: string }): void => {
	isDirty.value = true
	attachment.value = file.file_url
}

const getType = (): string[] | undefined => {
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

const removeSubmission = (): void => {
	isDirty.value = true
	attachment.value = null
}

// Grading lives on the standalone submission page only. Inside a lesson an
// instructor viewing their own submission would otherwise grade themselves.
const canGradeSubmission = computed(() => {
	return (
		!props.embedded &&
		Boolean(
			user.data?.is_moderator ||
				user.data?.is_evaluator ||
				user.data?.is_instructor
		) &&
		currentSubmission.value != 'new'
	)
})

const canModifyAssignment = computed(() => {
	if (scheduleBlocked.value) {
		return false
	}
	if (currentSubmission.value == 'new') {
		return true
	} else if (
		submissionDoc.value?.owner == user.data?.name &&
		submissionDoc.value?.status == 'Not Graded'
	) {
		return true
	}
	return false
})

const { scheduleBlocked, scheduleMessage } = useAssessmentSchedule(
	() => assignment.data,
	{
		opensOn: (date) => __('This assignment opens on {0}.').format(date),
		ended: () => __('The schedule for this assignment has ended.'),
	}
)

const saveLabel = computed(() =>
	currentSubmission.value == 'new' ? __('Submit') : __('Save')
)

const submissionStatusOptions = computed(() => {
	return [
		{ label: 'Not Graded', value: 'Not Graded' },
		{ label: 'Pass', value: 'Pass' },
		{ label: 'Fail', value: 'Fail' },
	]
})

const statusTheme = computed(() => {
	if (!submissionDoc.value) {
		return 'amber'
	} else if (submissionDoc.value.status == 'Pass') {
		return 'green'
	} else if (submissionDoc.value.status == 'Not Graded') {
		return 'blue'
	} else {
		return 'red'
	}
})

const showUploader = (): boolean => {
	return ['PDF', 'Image', 'Document'].includes(assignment.data?.type ?? '')
}
</script>
