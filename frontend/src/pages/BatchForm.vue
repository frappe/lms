<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
			<div class="flex items-center space-x-2">
				<Button v-if="batchDetail.data?.name" @click="deleteBatch">
					<template #icon>
						<Trash2 class="size-4 stroke-1.5" />
					</template>
				</Button>
				<Button variant="solid" @click="saveBatch()">
					{{ __('Save') }}
				</Button>
			</div>
		</header>
		<div class="py-5">
			<div class="px-5 md:px-20 pb-5 space-y-5 border-b mb-5">
				<div class="text-lg text-ink-gray-9 font-semibold mb-4">
					{{ __('Details') }}
				</div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
					<div class="space-y-5">
						<FormControl
							v-model="batch.title"
							:label="__('Title')"
							:required="true"
							class="w-full"
						/>
						<MultiSelect
							v-model="instructors"
							doctype="Course Evaluator"
							:label="__('Instructors')"
							:required="true"
							:onCreate="(close) => openSettings('Evaluators', close)"
							:filters="{ ignore_user_type: 1 }"
						/>
					</div>
					<FormControl
						v-model="batch.description"
						:label="__('Short Description')"
						type="textarea"
						:rows="8"
						:placeholder="__('Short description of the batch')"
						:required="true"
					/>
				</div>
			</div>

			<div class="px-5 md:px-20 pb-5 space-y-5 border-b mb-5">
				<div class="text-lg text-ink-gray-9 font-semibold mb-4">
					{{ __('Settings') }}
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
					<FormControl
						v-model="batch.published"
						type="checkbox"
						:label="__('Published')"
					/>
					<FormControl
						v-model="batch.allow_self_enrollment"
						type="checkbox"
						:label="__('Allow self enrollment')"
					/>
					<FormControl
						v-model="batch.certification"
						type="checkbox"
						:label="__('Certification')"
					/>
				</div>
			</div>

			<div class="px-5 md:px-20 pb-5 space-y-5 border-b mb-5">
				<div class="text-lg text-ink-gray-9 font-semibold mb-4">
					{{ __('Date and Time') }}
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-10">
					<div class="space-y-5">
						<FormControl
							v-model="batch.start_date"
							:label="__('Batch Start Date')"
							type="date"
							class="mb-4"
							:required="true"
						/>
						<FormControl
							v-model="batch.end_date"
							:label="__('Batch End Date')"
							type="date"
							class="mb-4"
							:required="true"
						/>
					</div>
					<div class="space-y-5">
						<FormControl
							v-model="batch.start_time"
							:label="__('Session Start Time')"
							type="time"
							class="mb-4"
							:required="true"
						/>
						<FormControl
							v-model="batch.end_time"
							:label="__('Session End Time')"
							type="time"
							class="mb-4"
							:required="true"
						/>
					</div>
					<div class="space-y-5">
						<FormControl
							v-model="batch.timezone"
							:label="__('Timezone')"
							type="text"
							:placeholder="__('Example: IST (+5:30)')"
							class="mb-4"
							:required="true"
						/>
						<FormControl
							v-model="batch.evaluation_end_date"
							:label="__('Evaluation End Date')"
							type="date"
							class="mb-4"
						/>
					</div>
				</div>
			</div>

			<div class="px-5 md:px-20 pb-5 space-y-5 border-b mb-5">
				<div>
					<label class="block text-sm text-ink-gray-5 mb-1">
						{{ __('Batch Details') }}
						<span class="text-ink-red-3">*</span>
					</label>
					<TextEditor
						:content="batch.batch_details"
						@change="(val) => (batch.batch_details = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x border-outline-gray-modals bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] max-h-[20rem] overflow-y-scroll mb-4"
					/>
				</div>
			</div>

			<div class="px-5 md:px-20 pb-5 space-y-5 border-b mb-5">
				<div class="text-lg text-ink-gray-9 font-semibold mb-4">
					{{ __('Configurations') }}
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-10">
					<div class="space-y-5">
						<FormControl
							v-model="batch.seat_count"
							:label="__('Seat Count')"
							type="number"
							class="mb-4"
							:placeholder="__('Number of seats available')"
						/>
						<Link
							doctype="Email Template"
							:label="__('Email Template')"
							v-model="batch.confirmation_email_template"
							:onCreate="
								(value, close) => {
									openSettings('Email Templates', close)
								}
							"
						/>
						<Link
							doctype="LMS Zoom Settings"
							:label="__('Zoom Account')"
							v-model="batch.zoom_account"
							:onCreate="
								(value, close) => {
									openSettings('Zoom Accounts', close)
								}
							"
						/>
					</div>
					<div class="space-y-5">
						<FormControl
							v-model="batch.medium"
							type="select"
							:options="[
								{
									label: 'Online',
									value: 'Online',
								},
								{
									label: 'Offline',
									value: 'Offline',
								},
							]"
							:label="__('Medium')"
							class="mb-4"
						/>
						<Link
							doctype="LMS Category"
							:label="__('Category')"
							v-model="batch.category"
							:onCreate="(value, close) => openSettings('Categories', close)"
						/>
					</div>
					<div class="space-y-5">
						<Uploader
							v-model="batch.video_link"
							:label="__('Preview Video')"
							type="video"
							:required="false"
						/>
					</div>
				</div>
			</div>

			<div class="px-5 md:px-20 pb-5 space-y-5">
				<div class="text-lg text-ink-gray-9 font-semibold">
					{{ __('Pricing') }}
				</div>
				<FormControl
					v-model="batch.paid_batch"
					type="checkbox"
					:label="__('Paid Batch')"
				/>
				<div
					v-if="batch.paid_batch"
					class="grid grid-cols-1 md:grid-cols-3 gap-5"
				>
					<FormControl
						v-model="batch.amount"
						:label="__('Amount')"
						type="number"
					/>
					<Link
						doctype="Currency"
						v-model="batch.currency"
						:filters="{ enabled: 1 }"
						:label="__('Currency')"
					/>
				</div>
			</div>

			<div class="px-5 md:px-20 pb-5 space-y-5 border-b">
				<div class="text-lg text-ink-gray-9 font-semibold">
					{{ __('Meta Tags') }}
				</div>
				<div class="space-y-5">
					<Uploader
						v-model="batch.meta_image"
						:label="__('Meta Image')"
						type="image"
						:required="false"
					/>
					<FormControl
						v-model="meta.description"
						:label="__('Meta Description')"
						type="textarea"
						:rows="7"
					/>
					<FormControl
						v-model="meta.keywords"
						:label="__('Meta Keywords')"
						type="textarea"
						:rows="7"
						:placeholder="__('Comma separated keywords for SEO')"
					/>
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
} from 'vue'
import {
	Breadcrumbs,
	FormControl,
	Button,
	TextEditor,
	createResource,
	usePageMeta,
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
import { Trash2 } from 'lucide-vue-next'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { sessionStore } from '../stores/session'
import Uploader from '@/components/Controls/Uploader.vue'
import MultiSelect from '@/components/Controls/MultiSelect.vue'
import Link from '@/components/Controls/Link.vue'

const router = useRouter()
const user = inject('$user')
const { brand } = sessionStore()
const { updateOnboardingStep } = useOnboarding('learning')
const instructors = ref([])
const app = getCurrentInstance()
const { capture } = useTelemetry()
const { $dialog } = app.appContext.config.globalProperties

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const batch = reactive({
	title: '',
	published: false,
	description: '',
	batch_details: '',
	start_date: '',
	end_date: '',
	start_time: '',
	end_time: '',
	timezone: '',
	evaluation_end_date: '',
	confirmation_email_template: '',
	seat_count: '',
	medium: '',
	category: '',
	allow_self_enrollment: false,
	certification: false,
	meta_image: null,
	paid_batch: false,
	currency: '',
	amount: 0,
	zoom_account: '',
	video_link: '',
})

const meta = reactive({
	description: '',
	keywords: '',
})

onMounted(() => {
	if (!user.data) window.location.href = '/login'
	if (props.batchName != 'new') {
		fetchBatchInfo()
	} else {
		capture('batch_form_opened')
	}
	window.addEventListener('keydown', keyboardShortcut)
})

const fetchBatchInfo = () => {
	batchDetail.reload()
	getMetaInfo('batches', props.batchName, meta)
}

const keyboardShortcut = (e) => {
	if (
		e.key === 's' &&
		(e.ctrlKey || e.metaKey) &&
		!e.target.classList.contains('ProseMirror')
	) {
		saveBatch()
		e.preventDefault()
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
})

const newBatch = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Batch',
				meta_image: batch.image,
				video_link: batch.video_link,
				instructors: instructors.value.map((instructor) => ({
					instructor: instructor,
				})),
				...batch,
			},
		}
	},
})

const batchDetail = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return {
			doctype: 'LMS Batch',
			name: props.batchName,
		}
	},
	onSuccess(data) {
		updateBatchData(data)
	},
})

const updateBatchData = (data) => {
	Object.keys(data).forEach((key) => {
		if (key == 'instructors') {
			data.instructors.forEach((instructor) => {
				instructors.value.push(instructor.instructor)
			})
		} else if (['start_time', 'end_time'].includes(key)) {
			batch[key] = formatTime(data[key])
		} else if (Object.hasOwn(batch, key)) batch[key] = data[key]
	})
	let checkboxes = [
		'published',
		'paid_batch',
		'allow_self_enrollment',
		'certification',
	]
	for (let idx in checkboxes) {
		let key = checkboxes[idx]
		batch[key] = batch[key] ? true : false
	}
}

const formatTime = (timeStr) => {
	let [hours, minutes, seconds] = timeStr.split(':')
	hours = hours.length == 1 ? '0' + hours : hours
	return `${hours}:${minutes}`
}

const editBatch = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'LMS Batch',
			name: props.batchName,
			fieldname: {
				meta_image: batch.meta_image,
				video_link: batch.video_link,
				instructors: instructors.value.map((instructor) => ({
					instructor: instructor,
				})),
				...batch,
			},
		}
	},
})

const validateFields = () => {
	batch.description = sanitizeHTML(batch.description)
	batch.batch_details = sanitizeHTML(batch.batch_details)

	Object.keys(batch).forEach((key) => {
		if (
			!['description', 'batch_details'].includes(key) &&
			typeof batch[key] === 'string'
		) {
			batch[key] = escapeHTML(batch[key])
		}
	})
}

const saveBatch = () => {
	validateFields()
	if (batchDetail.data) {
		editBatchDetails()
	} else {
		createNewBatch()
	}
}

const createNewBatch = () => {
	newBatch.submit(
		{},
		{
			onSuccess(data) {
				if (user.data?.is_system_manager) {
					updateOnboardingStep('create_first_batch', true, false, () => {
						localStorage.setItem('firstBatch', data.name)
					})
				}
				updateMetaInfo('batches', data.name, meta)
				capture('batch_created')
				router.push({
					name: 'BatchDetail',
					params: {
						batchName: data.name,
					},
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const editBatchDetails = () => {
	editBatch.submit(
		{},
		{
			onSuccess(data) {
				updateMetaInfo('batches', data.name, meta)
				router.push({
					name: 'BatchDetail',
					params: {
						batchName: data.name,
					},
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
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
		batch: props.batchName,
	}).then(() => {
		toast.success(__('Batch deleted successfully'))
		close()
		router.push({
			name: 'Batches',
		})
	})
}

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: __('Batches'),
			route: {
				name: 'Batches',
			},
		},
	]
	if (batchDetail.data) {
		crumbs.push({
			label: batchDetail.data.title,
			route: {
				name: 'BatchDetail',
				params: {
					batchName: props.batchName,
				},
			},
		})
	}
	crumbs.push({
		label: props.batchName == 'new' ? __('New Batch') : __('Edit Batch'),
		route: { name: 'BatchForm', params: { batchName: props.batchName } },
	})
	return crumbs
})

usePageMeta(() => {
	return {
		title: props.batchName == 'new' ? 'New Batch' : batchDetail.data?.title,
		icon: brand.favicon,
	}
})
</script>
