<template>
	<div class="">
		<div class="grid grid-cols-1 lg:grid-cols-[3fr,2fr]">
			<div v-if="batchDetail.doc" class="py-5 lg:h-[88vh] lg:overflow-y-auto">
				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-base font-semibold text-ink-gray-9">
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

						<FormControl
							v-model="batchDetail.doc.start_time"
							:label="__('Session Start Time')"
							type="time"
							:required="true"
							variant="outline"
						/>
						<FormControl
							v-model="batchDetail.doc.end_time"
							:label="__('Session End Time')"
							type="time"
							:required="true"
							variant="outline"
						/>
						<div class="space-y-1.5">
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
					<div class="text-base font-semibold text-ink-gray-9">
						{{ __('Enrollment & Certification') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
						<Switch
							size="sm"
							v-model="batchDetail.doc.allow_self_enrollment"
							:label="__('Allow Self Enrollment')"
							:description="
								__('Allow users to enroll in this batch on their own.')
							"
						/>
						<Switch
							size="sm"
							v-model="batchDetail.doc.certification"
							:label="__('Certification')"
							:description="__('Issue certificates to batch participants.')"
						/>
						<div class="space-y-4">
							<Switch
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
							<Switch
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
					<div class="text-base font-semibold text-ink-gray-9">
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
							:rows="4"
							:placeholder="__('Short description of the batch')"
							:required="true"
							variant="outline"
							class="md:col-span-2"
						/>
					</div>
					<Uploader
						v-model="batchDetail.doc.video_link"
						:label="__('Preview Video')"
						type="video"
						:required="false"
					/>
					<div class="space-y-1.5">
						<FormLabel
							:label="__('Batch Details')"
							:id="batchDetailsId"
							:required="true"
						/>
						<div
							class="rounded-t-lg rounded-b-md outline-none transition-[box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:ring-2 ring-outline-gray-3"
						>
							<TextEditor
								:id="batchDetailsId"
								:content="batchDetail.doc.batch_details"
								@change="(val) => (batchDetail.doc.batch_details = val)"
								:editable="true"
								:fixedMenu="true"
								editorClass="prose-sm max-w-none border-b border-x border-outline-gray-2 hover:border-outline-gray-3 hover:shadow-sm focus-within:border-outline-gray-4 focus-within:shadow-sm rounded-b-md py-1 px-2 min-h-[7rem] max-h-[16rem] overflow-y-scroll transition-colors"
							/>
						</div>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-base font-semibold text-ink-gray-9">
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
					<div class="text-base font-semibold text-ink-gray-9">
						{{ __('Meta Tags') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<FormControl
							v-model="meta.description"
							:label="__('Meta Description')"
							type="textarea"
							:rows="4"
							variant="outline"
						/>
						<FormControl
							v-model="meta.keywords"
							:label="__('Meta Keywords')"
							type="textarea"
							:rows="4"
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
<script setup>
import {
	computed,
	getCurrentInstance,
	inject,
	onMounted,
	onBeforeUnmount,
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
	TextEditor,
	createDocumentResource,
	createResource,
	toast,
	call,
	createListResource,
} from 'frappe-ui'
import Switch from '@/components/Controls/Switch.vue'
import {
	createLMSCategory,
	getMetaInfo,
	openSettings,
	updateMetaInfo,
} from '@/utils'
import { useRouter } from 'vue-router'
import { useTelemetry } from 'frappe-ui/frappe'
import Uploader from '@/components/Controls/Uploader.vue'
import MultiLink from '@/components/Controls/MultiLink.vue'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import BatchCourses from '@/pages/Batches/components/BatchCourses.vue'
import Assessments from '@/pages/Batches/components/Assessments.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import EmailTemplateModal from '@/components/Modals/EmailTemplateModal.vue'

const router = useRouter()
const user = inject('$user')
const instructors = ref([])
const app = getCurrentInstance()
const { capture } = useTelemetry()
const { $dialog } = app.appContext.config.globalProperties
const isDirty = ref(false)
const originalDoc = ref(null)
const batchDetailsId = useId()
const showMemberModal = ref(false)
const showEmailTemplateModal = ref(false)
const emailTemplateLinkRef = ref(null)

const emailTemplates = createListResource({
	doctype: 'Email Template',
	fields: ['name', 'subject', 'use_html', 'response', 'response_html'],
	auto: true,
	orderBy: 'modified desc',
	cache: 'email-templates',
})

const onEmailTemplateCreated = (name) => {
	batchDetail.doc.confirmation_email_template = name
	emailTemplateLinkRef.value?.reload()
}

const createCategory = (name, done) => {
	createLMSCategory(name).then((categoryName) => {
		if (!categoryName) return
		batchDetail.doc.category = categoryName
		done()
	})
}

const onInstructorCreated = (user) => {
	instructors.value = [...instructors.value, user.name]
}

const meta = reactive({
	description: '',
	keywords: '',
})

const props = defineProps({
	batch: {
		type: Object,
		required: true,
	},
})

onMounted(() => {
	if (!user.data) window.location.href = '/login'
	window.addEventListener('keydown', keyboardShortcut)
})

const keyboardShortcut = (e) => {
	if (
		e.key === 's' &&
		(e.ctrlKey || e.metaKey) &&
		!e.target.classList.contains('ProseMirror')
	) {
		submitBatch()
		e.preventDefault()
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
})

const batchDetail = createDocumentResource({
	doctype: 'LMS Batch',
	name: props.batch.data?.name,
	auto: true,
})

watch(
	() => batchDetail.doc,
	() => {
		if (!batchDetail.doc) return

		if (originalDoc.value) {
			isDirty.value =
				JSON.stringify(batchDetail.doc) !== JSON.stringify(originalDoc.value)
		}

		updateBatchData()
		getMetaInfo('batches', batchDetail.doc?.name, meta)
	},
	{ deep: true }
)

const updateBatchData = () => {
	Object.keys(batchDetail.doc).forEach((key) => {
		if (key == 'instructors') {
			instructors.value = []
			batchDetail.doc.instructors.forEach((instructor) => {
				instructors.value.push(instructor.instructor)
			})
		} else if (['start_time', 'end_time'].includes(key)) {
			batchDetail.doc[key] = formatTime(batchDetail.doc[key])
		}
	})
	let checkboxes = [
		'published',
		'paid_batch',
		'allow_self_enrollment',
		'certification',
		'evaluation',
	]
	for (let idx in checkboxes) {
		let key = checkboxes[idx]
		batchDetail.doc[key] = batchDetail.doc[key] ? true : false
	}
	originalDoc.value = structuredClone(toRaw(batchDetail.doc))
}

const formatTime = (timeStr) => {
	let [hours, minutes, seconds] = timeStr.split(':')
	hours = hours.length == 1 ? '0' + hours : hours
	return `${hours}:${minutes}`
}

const submitBatch = () => {
	updateBatch()
}

const updateBatch = () => {
	batchDetail.setValue.submit(
		{
			...batchDetail.doc,
			instructors: instructors.value.map((instructor) => ({
				instructor: instructor,
			})),
		},
		{
			onSuccess(data) {
				updateMetaInfo('batches', data.name, meta)
				toast.success(__('Batch updated successfully'))
				nextTick(() => {
					originalDoc.value = structuredClone(data)
					isDirty.value = false
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
				console.error(err)
			},
		}
	)
}

const deleteBatch = () => {
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

const trashBatch = (close) => {
	call('lms.lms.api.delete_batch', {
		batch: props.batch.data.name,
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
	transform: (data) => data.all_timezones,
})

const timezoneOptions = computed(() =>
	(timezoneResource.data || []).map((tz) => ({ label: tz, value: tz }))
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
