<template>
	<div class="">
		<div class="grid grid-cols-[3fr,2fr]">
			<div v-if="batchDetail.doc" class="py-5 h-[88vh] overflow-y-auto">
				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-lg text-ink-gray-9 font-semibold mb-4">
						{{ __('Details') }}
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div class="space-y-5">
							<FormControl
								v-model="batchDetail.doc.published"
								type="checkbox"
								:label="__('Published')"
							/>
							<FormControl
								v-model="batchDetail.doc.title"
								:label="__('Title')"
								:required="true"
								class="w-full"
							/>
							<FormControl
								v-model="batchDetail.doc.start_date"
								:label="__('Batch Start Date')"
								type="date"
								class="mb-4"
								:required="true"
							/>
							<FormControl
								v-model="batchDetail.doc.end_date"
								:label="__('Batch End Date')"
								type="date"
								class="mb-4"
								:required="true"
							/>
							<FormControl
								v-model="batchDetail.doc.seat_count"
								:label="__('Seat Count')"
								type="number"
								class="mb-4"
								:placeholder="__('Number of seats available')"
							/>
						</div>
						<div class="space-y-5">
							<FormControl
								v-model="batchDetail.doc.allow_self_enrollment"
								type="checkbox"
								:label="__('Allow Self Enrollment')"
							/>
							<FormControl
								v-model="batchDetail.doc.start_time"
								:label="__('Session Start Time')"
								type="time"
								class="mb-4"
								:required="true"
							/>
							<FormControl
								v-model="batchDetail.doc.end_time"
								:label="__('Session End Time')"
								type="time"
								class="mb-4"
								:required="true"
							/>
							<FormControl
								v-model="batchDetail.doc.timezone"
								:label="__('Timezone')"
								type="text"
								:placeholder="__('Example: IST (+5:30)')"
								class="mb-4"
								:required="true"
							/>

							<Link
								doctype="LMS Category"
								:label="__('Category')"
								v-model="batchDetail.doc.category"
								:onCreate="(value, close) => openSettings('Categories', close)"
							/>
						</div>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-lg text-ink-gray-9 font-semibold mb-4">
						{{ __('Certification') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
						<div class="flex flex-col space-y-5">
							<FormControl
								v-model="batchDetail.doc.evaluation"
								type="checkbox"
								:label="__('Evaluation')"
							/>
							<FormControl
								v-if="batchDetail.doc.evaluation"
								v-model="batchDetail.doc.evaluation_end_date"
								:label="__('Evaluation End Date')"
								type="date"
								class="mb-4"
							/>
						</div>
						<div>
							<FormControl
								v-model="batchDetail.doc.certification"
								type="checkbox"
								:label="__('Certification')"
							/>
						</div>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div class="space-y-5">
							<FormControl
								v-model="batchDetail.doc.description"
								:label="__('Short Description')"
								type="textarea"
								:rows="4"
								:placeholder="__('Short description of the batch')"
								:required="true"
							/>
							<MultiSelect
								v-model="instructors"
								doctype="Course Evaluator"
								:label="__('Instructors')"
								:required="true"
								:onCreate="(close) => openSettings('Evaluators', close)"
								:filters="{ ignore_user_type: 1 }"
							/>
							<Uploader
								v-model="batchDetail.doc.video_link"
								:label="__('Preview Video')"
								type="video"
								:required="false"
							/>
						</div>
						<div>
							<label class="block text-sm text-ink-gray-5 mb-2">
								{{ __('Batch Details') }}
								<span class="text-ink-red-3">*</span>
							</label>
							<TextEditor
								:content="batchDetail.doc.batch_details"
								@change="(val) => (batchDetail.doc.batch_details = val)"
								:editable="true"
								:fixedMenu="true"
								editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] max-h-[16rem] overflow-y-scroll mb-4"
							/>
						</div>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div class="space-y-5">
							<FormControl
								v-model="batchDetail.doc.medium"
								type="select"
								:options="mediumOptions"
								:label="__('Medium')"
								class="mb-4"
							/>
							<Link
								doctype="Email Template"
								:label="__('Enrollment Confirmation Email Template')"
								v-model="batchDetail.doc.confirmation_email_template"
								:onCreate="
									(value, close) => {
										openSettings('Email Templates', close)
									}
								"
							/>
						</div>
						<div class="space-y-5">
							<Link
								doctype="LMS Zoom Settings"
								:label="__('Zoom Account')"
								v-model="batchDetail.doc.zoom_account"
								:onCreate="
									(value, close) => {
										openSettings('Zoom Accounts', close)
									}
								"
							/>
						</div>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5 border-b mb-5">
					<div class="text-lg text-ink-gray-9 font-semibold">
						{{ __('Pricing') }}
					</div>
					<FormControl
						v-model="batchDetail.doc.paid_batch"
						type="checkbox"
						:label="__('Paid Batch')"
					/>
					<div
						v-if="batchDetail.doc.paid_batch"
						class="grid grid-cols-1 md:grid-cols-2 gap-5"
					>
						<FormControl
							v-model="batchDetail.doc.amount"
							:label="__('Amount')"
							type="number"
						/>
						<Link
							doctype="Currency"
							v-model="batchDetail.doc.currency"
							:filters="{ enabled: 1 }"
							:label="__('Currency')"
						/>
					</div>
				</div>

				<div class="px-5 pb-5 space-y-5">
					<div class="text-lg text-ink-gray-9 font-semibold">
						{{ __('Meta Tags') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<FormControl
							v-model="meta.description"
							:label="__('Meta Description')"
							type="textarea"
							:rows="4"
						/>
						<FormControl
							v-model="meta.keywords"
							:label="__('Meta Keywords')"
							type="textarea"
							:rows="4"
							:placeholder="__('Comma separated keywords')"
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
			<div class="border-l min-w-0">
				<div class="border-b p-4">
					<BatchCourses :batch="batch" />
				</div>
				<div class="p-4">
					<Assessments :batch="batch.data?.name" />
				</div>
			</div>
		</div>
	</div>
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
} from 'vue'
import {
	FormControl,
	TextEditor,
	createDocumentResource,
	toast,
	call,
} from 'frappe-ui'
import {
	escapeHTML,
	getMetaInfo,
	openSettings,
	sanitizeHTML,
	updateMetaInfo,
} from '@/utils'
import { useRouter } from 'vue-router'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { sessionStore } from '@/stores/session'
import Uploader from '@/components/Controls/Uploader.vue'
import MultiSelect from '@/components/Controls/MultiSelect.vue'
import Link from '@/components/Controls/Link.vue'
import BatchCourses from '@/pages/Batches/components/BatchCourses.vue'
import Assessments from '@/pages/Batches/components/Assessments.vue'

const router = useRouter()
const user = inject('$user')
const { brand } = sessionStore()
const { updateOnboardingStep } = useOnboarding('learning')
const instructors = ref([])
const app = getCurrentInstance()
const { capture } = useTelemetry()
const { $dialog } = app.appContext.config.globalProperties
const isDirty = ref(false)
const originalDoc = ref(null)

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
		getMetaInfo('batches', batchDetail.doc?.name, meta)
		updateBatchData()
	}
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

const validateFields = () => {
	batchDetail.doc.description = sanitizeHTML(batchDetail.doc.description)
	batchDetail.doc.batch_details = sanitizeHTML(batchDetail.doc.batch_details)

	Object.keys(batchDetail.doc).forEach((key) => {
		if (
			!['description', 'batch_details'].includes(key) &&
			typeof batchDetail.doc[key] === 'string'
		) {
			batchDetail.doc[key] = escapeHTML(batchDetail.doc[key])
		}
	})
}

const submitBatch = () => {
	validateFields()
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

watch(
	() => batchDetail.doc,
	() => {
		if (originalDoc.value) {
			isDirty.value =
				JSON.stringify(batchDetail.doc) !== JSON.stringify(originalDoc.value)
		}
	},
	{ deep: true }
)

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

const mediumOptions = computed(() => {
	return [
		{
			label: 'Online',
			value: 'Online',
		},
		{
			label: 'Offline',
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
