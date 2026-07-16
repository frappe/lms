<template>
	<div class="">
		<div class="grid grid-cols-1 lg:grid-cols-[3fr,2fr]">
			<div v-if="batchDetail.doc" class="py-5 lg:h-[88vh] lg:overflow-y-auto">
				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-base-semibold text-ink-gray-9">
						{{ __('Details') }}
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<FormControl
							v-model="batchDetail.doc.title"
							:label="__('Title')"
							:required="true"
							variant="outline"
							class="w-full"
						/>
						<Link
							v-model="batchDetail.doc.category"
							doctype="LMS Category"
							:label="__('Category')"
							:inlineCreate="true"
							variant="outline"
							:onCreate="createCategory"
						/>
						<FormControl
							v-model="batchDetail.doc.start_date"
							:label="__('Batch Start Date')"
							type="date"
							:required="true"
							variant="outline"
						/>
						<FormControl
							v-model="batchDetail.doc.end_date"
							:label="__('Batch End Date')"
							type="date"
							:required="true"
							variant="outline"
						/>

						<!-- beta.7's TimePicker (FormControl type="time") ignores the
						     `label` prop, so render FormLabel explicitly like Timezone
						     below — otherwise these fields show only the placeholder. -->
						<div class="space-y-1.5">
							<FormLabel :label="__('Session Start Time')" :required="true" />
							<FormControl
								v-model="batchDetail.doc.start_time"
								type="time"
								variant="outline"
							/>
						</div>
						<div class="space-y-1.5">
							<FormLabel :label="__('Session End Time')" :required="true" />
							<FormControl
								v-model="batchDetail.doc.end_time"
								type="time"
								variant="outline"
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<FormLabel :label="__('Timezone')" :required="true" />
							<Combobox
								v-model="batchDetail.doc.timezone"
								:options="timezoneOptions"
								:placeholder="__('Select timezone')"
								variant="outline"
								class="w-full"
							/>
						</div>

						<FormControl
							v-model="batchDetail.doc.seat_count"
							:label="__('Seat Count')"
							type="number"
							variant="outline"
							:placeholder="__('Number of seats available')"
						/>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-base-semibold text-ink-gray-9">
						{{ __('Enrollment & Certification') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
						<BooleanSwitch
							size="sm"
							v-model="batchDetail.doc.allow_self_enrollment"
							:label="__('Allow Self Enrollment')"
							:description="
								__('Allow users to enroll in this batch on their own.')
							"
						/>
						<BooleanSwitch
							size="sm"
							v-model="batchDetail.doc.certification"
							:label="__('Certification')"
							:description="__('Issue certificates to batch participants.')"
						/>
						<div class="space-y-4">
							<BooleanSwitch
								size="sm"
								v-model="batchDetail.doc.paid_batch"
								:label="__('Paid Batch')"
								:description="__('Charge a fee for batch enrollment.')"
							/>
							<div
								v-if="batchDetail.doc.paid_batch"
								class="grid grid-cols-2 gap-3"
							>
								<FormControl
									v-model="batchDetail.doc.amount"
									:label="__('Amount')"
									type="number"
									variant="outline"
								/>
								<Link
									doctype="Currency"
									v-model="batchDetail.doc.currency"
									:filters="{ enabled: 1 }"
									:label="__('Currency')"
									variant="outline"
								/>
							</div>
						</div>
						<div class="space-y-4">
							<BooleanSwitch
								size="sm"
								v-model="batchDetail.doc.evaluation"
								:label="__('Evaluation')"
								:description="__('Enable evaluations for batch participants.')"
							/>
							<FormControl
								v-if="batchDetail.doc.evaluation"
								v-model="batchDetail.doc.evaluation_end_date"
								:label="__('Evaluation End Date')"
								type="date"
								variant="outline"
							/>
						</div>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-base-semibold text-ink-gray-9">
						{{ __('Batch overview') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<MultiLink
							v-model="instructors"
							doctype="User"
							url="lms.lms.api.search_users_by_role"
							:searchParams="{ roles: JSON.stringify(['Batch Evaluator']) }"
							:label="__('Instructors')"
							:placeholder="__('Select instructors')"
							:required="true"
							variant="outline"
							:onCreate="() => (showMemberModal = true)"
						/>
						<Select
							v-model="batchDetail.doc.medium"
							:label="__('Medium')"
							:options="mediumOptions"
							variant="outline"
							class="w-full"
						/>
						<Link
							ref="emailTemplateLinkRef"
							doctype="Email Template"
							:label="__('Enrollment Confirmation Email Template')"
							v-model="batchDetail.doc.confirmation_email_template"
							variant="outline"
							:onCreate="
								(value, close) => {
									if (close) close()
									showEmailTemplateModal = true
								}
							"
						/>
						<FormControl
							v-model="batchDetail.doc.description"
							:label="__('Short Description')"
							type="textarea"
							:placeholder="__('Short description of the batch')"
							:required="true"
							variant="outline"
							class="md:col-span-2"
						/>
					</div>
					<VideoPreviewField
						v-model="batchDetail.doc.video_link"
						:label="__('Preview Video')"
					/>
					<div class="space-y-1.5">
						<FormLabel
							:label="__('Batch Details')"
							:id="batchDetailsId"
							:required="true"
						/>
						<div
							class="rounded-t-lg rounded-b-md outline-none transition-[box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
						>
							<RichTextEditor
								:id="batchDetailsId"
								:content="batchDetail.doc.batch_details"
								@change="(val: string) => updateBatchDetails(val)"
								:editable="true"
								:fixedMenu="true"
								editorClass="prose-sm max-w-none border-b border-x border-outline-gray-2 hover:border-outline-gray-3 hover:shadow-sm focus-within:border-outline-gray-4 focus-within:shadow-sm rounded-b-md py-1 px-2 min-h-[7rem] max-h-[16rem] overflow-y-scroll transition-colors"
							/>
						</div>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-base-semibold text-ink-gray-9">
						{{ __('Conferencing') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<Select
							v-model="batchDetail.doc.conferencing_provider"
							:options="conferencingOptions"
							:label="__('Conferencing Provider')"
							variant="outline"
							class="w-full"
						/>
						<Link
							v-if="batchDetail.doc.conferencing_provider === 'Zoom'"
							doctype="LMS Zoom Settings"
							:label="__('Zoom Account')"
							v-model="batchDetail.doc.zoom_account"
							variant="outline"
							:onCreate="
								(value, close) => {
									openSettings('Zoom Accounts', close)
								}
							"
						/>
						<Link
							v-if="batchDetail.doc.conferencing_provider === 'Google Meet'"
							doctype="LMS Google Meet Settings"
							:label="__('Google Meet Account')"
							v-model="batchDetail.doc.google_meet_account"
							variant="outline"
							:onCreate="
								(value, close) => {
									openSettings('Google Meet Accounts', close)
								}
							"
						/>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5">
					<div class="text-base-semibold text-ink-gray-9">
						{{ __('Meta Tags') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<FormControl
							v-model="meta.description"
							:label="__('Meta Description')"
							type="textarea"
							variant="outline"
						/>
						<FormControl
							v-model="meta.keywords"
							:label="__('Meta Keywords')"
							type="textarea"
							:placeholder="__('Comma separated keywords')"
							variant="outline"
						/>
						<Uploader
							v-model="batchDetail.doc.meta_image"
							:label="__('Meta Image')"
							type="image"
							:required="false"
						/>
					</div>
				</div>
			</div>
			<div class="border-s min-w-0">
				<div class="border-b p-4">
					<BatchCourses :batch="batch" />
				</div>
				<div class="p-4">
					<Assessments :batch="batch.data?.name" />
				</div>
			</div>
		</div>
	</div>
	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['batch_evaluator']"
		@created="onInstructorCreated"
	/>
	<EmailTemplateModal
		v-model="showEmailTemplateModal"
		v-model:emailTemplates="emailTemplates"
		templateID="new"
		@created="onEmailTemplateCreated"
	/>
</template>
<script setup lang="ts">
import {
	computed,
	getCurrentInstance,
	inject,
	onMounted,
	reactive,
	ref,
	toRaw,
	watch,
	nextTick,
	useId,
} from 'vue'
import {
	Combobox,
	FormControl,
	FormLabel,
	createDocumentResource,
	createResource,
	toast,
	call,
	createListResource,
} from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import {
	createLMSCategory,
	getMetaInfo,
	openSettings,
	updateMetaInfo,
} from '@/utils'
import { validateBatch } from '@/utils/batchForm'
import {
	useKeyboardShortcuts,
	saveShortcut,
} from '@/composables/useKeyboardShortcuts'
import { useRouter } from 'vue-router'
import Uploader from '@/components/Controls/Uploader.vue'
import VideoPreviewField from '@/components/Controls/VideoPreviewField.vue'
import MultiLink from '@/components/Controls/MultiLink.vue'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import BatchCourses from '@/pages/Batches/components/BatchCourses.vue'
import Assessments from '@/pages/Batches/components/Assessments.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import EmailTemplateModal from '@/components/Modals/EmailTemplateModal.vue'
import type { LMSBatch } from '@/types/lms/LMSBatch'
import type { CourseInstructor } from '@/types/lms/CourseInstructor'
import type { Resource, BatchDetails, SessionUser } from '@/types/api'
import RichTextEditor from '@/components/RichTextEditor.vue'

interface DialogAction {
	label: string
	theme?: string
	variant?: string
	onClick: (ctx: { close: () => void }) => void
}
type DialogFn = (opts: {
	title: string
	message: string
	actions: DialogAction[]
}) => void

const props = defineProps<{
	batch: Resource<BatchDetails | null>
}>()

const router = useRouter()
const user = inject<SessionUser>('$user')!
const instructors = ref<string[]>([])
const app = getCurrentInstance()!
const { $dialog } = app.appContext.config.globalProperties as {
	$dialog: DialogFn
}
const isDirty = ref<boolean>(false)
const originalDoc = ref<LMSBatch | null>(null)
const batchDetailsId = useId()
const showMemberModal = ref<boolean>(false)
const showEmailTemplateModal = ref<boolean>(false)
const emailTemplateLinkRef = ref<{ reload: () => void } | null>(null)

const batchDetail = createDocumentResource({
	doctype: 'LMS Batch',
	name: props.batch.data?.name,
	auto: true,
}) as Resource<LMSBatch | null>

const emailTemplates = createListResource({
	doctype: 'Email Template',
	fields: ['name', 'subject', 'use_html', 'response', 'response_html'],
	auto: true,
	orderBy: 'modified desc',
	cache: 'email-templates',
})

const onEmailTemplateCreated = (name: string): void => {
	if (batchDetail.doc) batchDetail.doc.confirmation_email_template = name
	emailTemplateLinkRef.value?.reload()
}

const updateBatchDetails = (value: string): void => {
	if (batchDetail.doc) batchDetail.doc.batch_details = value
}

const createCategory = (name: string, done: () => void): void => {
	createLMSCategory(name).then((categoryName: string | null) => {
		if (!categoryName) return
		if (batchDetail.doc) batchDetail.doc.category = categoryName
		done()
	})
}

const onInstructorCreated = (createdUser: { name: string }): void => {
	instructors.value = [...instructors.value, createdUser.name]
}

const meta = reactive<{ description: string; keywords: string }>({
	description: '',
	keywords: '',
})

const validateForm = (): string | null =>
	validateBatch({
		doc: batchDetail.doc ?? null,
		instructors: instructors.value,
	})

// Tracks the last validation error surfaced to the user so a repeated autosave
// attempt with the same unmet requirement doesn't re-toast on every keystroke.
let lastAutoSaveError: string | null = null

// Debounced so a burst of edits collapses into a single save shortly after the
// user pauses (mirrors CourseForm). When a mandatory field is empty or the
// amount is invalid, the autosave can't succeed — surface the reason once and
// keep the "Not Saved" badge (isDirty stays true) so the change isn't lost.
const autoSave = useDebounceFn((): void => {
	if (!isDirty.value) return
	const error = validateForm()
	if (error) {
		if (error !== lastAutoSaveError) {
			toast.error(error)
			lastAutoSaveError = error
		}
		return
	}
	lastAutoSaveError = null
	updateBatch({ silent: true })
}, 1000)

onMounted(() => {
	if (!user.data) window.location.href = '/login'
})

useKeyboardShortcuts({ shortcuts: [saveShortcut(() => submitBatch())] })

watch(
	() => batchDetail.doc,
	() => {
		if (!batchDetail.doc) return

		if (originalDoc.value) {
			isDirty.value =
				JSON.stringify(batchDetail.doc) !== JSON.stringify(originalDoc.value)
			if (isDirty.value) autoSave()
		}

		updateBatchData()
		getMetaInfo('batches', batchDetail.doc?.name, meta)
	},
	{ deep: true }
)

const updateBatchData = (): void => {
	const doc = batchDetail.doc
	if (!doc) return
	Object.keys(doc).forEach((key) => {
		if (key == 'instructors') {
			instructors.value = []
			doc.instructors?.forEach((instructor: CourseInstructor) => {
				if (instructor.instructor) instructors.value.push(instructor.instructor)
			})
		} else if (key === 'start_time' || key === 'end_time') {
			doc[key] = formatTime(doc[key])
		}
	})
	const checkboxes: (keyof LMSBatch)[] = [
		'published',
		'paid_batch',
		'allow_self_enrollment',
		'certification',
		'evaluation',
	]
	for (const key of checkboxes) {
		;(doc as Record<string, unknown>)[key] = doc[key] ? true : false
	}
	originalDoc.value = structuredClone(toRaw(doc))
}

const formatTime = (timeStr: string): string => {
	const [hours, minutes] = timeStr.split(':')
	const paddedHours = hours.length == 1 ? '0' + hours : hours
	return `${paddedHours}:${minutes}`
}

const submitBatch = (): void => {
	const error = validateForm()
	if (error) {
		toast.error(error)
		lastAutoSaveError = error
		return
	}
	lastAutoSaveError = null
	updateBatch()
}

const updateBatch = (opts: { silent?: boolean } = {}): void => {
	if (!batchDetail.doc) return
	batchDetail.setValue.submit(
		{
			...batchDetail.doc,
			instructors: instructors.value.map((instructor) => ({
				instructor: instructor,
			})),
		},
		{
			onSuccess(data: LMSBatch) {
				updateMetaInfo('batches', data.name, meta)
				if (!opts.silent) toast.success(__('Batch updated successfully'))
				nextTick(() => {
					originalDoc.value = structuredClone(data)
					isDirty.value = false
				})
				// Refresh the shared batch resource so the Overview tab (which reads
				// title/description/batch_details from this same resource) reflects
				// the saved changes without a page reload (mirrors CourseForm).
				props.batch.reload()
			},
			onError(err: { messages?: string[] } | string) {
				const msg =
					typeof err === 'string' ? err : err.messages?.[0] ?? __('Error')
				// Autosave failures stay quiet; the orange "Not Saved" badge remains
				// (isDirty is untouched) so the change isn't silently lost.
				if (!opts.silent) toast.error(msg)
				console.error(err)
			},
		}
	)
}

const deleteBatch = (): void => {
	$dialog({
		title: __('Confirm your action to delete'),
		message: __(
			'Deleting this batch will also delete all its data including enrolled students, linked courses, assessments, feedback and discussions. Are you sure you want to continue?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }) {
					trashBatch(close)
					close()
				},
			},
		],
	})
}

const trashBatch = (close: () => void): void => {
	call('lms.lms.api.delete_batch', {
		batch: props.batch.data?.name,
	}).then(() => {
		toast.success(__('Batch deleted successfully'))
		close()
		router.push({
			name: 'Batches',
		})
	})
}

const conferencingOptions = computed(() => {
	return [
		{
			label: '',
			value: '',
		},
		{
			label: __('Zoom'),
			value: 'Zoom',
		},
		{
			label: __('Google Meet'),
			value: 'Google Meet',
		},
	]
})

const timezoneResource = createResource({
	url: 'frappe.geo.country_info.get_country_timezone_info',
	auto: true,
	transform: (data: { all_timezones: string[] }) => data.all_timezones,
}) as Resource<string[]>

const timezoneOptions = computed(() =>
	(timezoneResource.data || []).map((tz: string) => ({ label: tz, value: tz }))
)

const mediumOptions = computed(() => {
	return [
		{
			label: __('Online'),
			value: 'Online',
		},
		{
			label: __('Offline'),
			value: 'Offline',
		},
	]
})

defineExpose({
	submitBatch,
	deleteBatch,
	isDirty,
})
</script>
