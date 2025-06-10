<template>
	<Dialog
		v-model="show"
		:options="{
			size: '2xl',
		}"
	>
		<template #body>
			<div class="flex text-base">
				<div class="flex flex-col w-1/2 p-5">
					<div class="text-lg font-semibold mb-4">
						{{ event.title }}
					</div>

					<div class="flex flex-col space-y-4 text-sm text-ink-gray-8">
						<Tooltip :text="__('Email ID')">
							<div class="flex items-center space-x-2 w-fit">
								<User class="h-4 w-4 stroke-1.5" />
								<span>
									{{ event.member }}
								</span>
							</div>
						</Tooltip>
						<Tooltip :text="__('Course')">
							<div class="flex items-center space-x-2 w-fit">
								<BookOpen class="h-4 w-4 stroke-1.5" />
								<span>
									{{ event.course_title }}
								</span>
							</div>
						</Tooltip>
						<Tooltip v-if="event.batch_title" :text="__('Batch')">
							<div class="flex items-center space-x-2 w-fit">
								<Users class="h-4 w-4 stroke-1.5" />
								<span>
									{{ event.batch_title }}
								</span>
							</div>
						</Tooltip>
						<Tooltip :text="__('Date')">
							<div class="flex items-center space-x-2 w-fit">
								<Calendar class="h-4 w-4 stroke-1.5" />
								<span>
									{{ dayjs(event.date).format('DD MMM YYYY') }}
								</span>
							</div>
						</Tooltip>
						<Tooltip :text="__('Time')">
							<div class="flex items-center space-x-2 w-fit">
								<Clock class="h-4 w-4 stroke-1.5" />
								<span>
									{{ formatTime(event.start_time) }} -
									{{ formatTime(event.end_time) }}
								</span>
							</div>
						</Tooltip>
					</div>
					<div class="flex items-center space-x-2 mt-auto">
						<Button
							v-if="certificate.name"
							@click="openCertificate(certificate)"
							class="w-full"
						>
							<template #prefix>
								<FileText class="h-4 w-4 stroke-1.5" />
							</template>
							{{ __('View Certificate') }}
						</Button>
						<Button v-else @click="openCallLink(event.venue)" class="w-full">
							<template #prefix>
								<Video class="h-4 w-4 stroke-1.5" />
							</template>
							<span>
								{{ __('Join Meeting') }}
							</span>
						</Button>
					</div>
				</div>
				<Tabs :tabs="tabs" as="div" v-model="tabIndex" class="border-l w-1/2">
					<template #tab-panel="{ tab }">
						<div
							v-if="tab.label == 'Evaluation'"
							class="flex flex-col space-y-4 p-5"
						>
							<div class="flex items-center justify-between">
								<Rating v-model="evaluation.rating" :label="__('Rating')" />
								<FormControl
									type="select"
									:options="statusOptions"
									v-model="evaluation.status"
									:label="__('Status')"
									class="w-1/2"
								/>
							</div>
							<Textarea
								v-model="evaluation.summary"
								:label="__('Summary')"
								:rows="7"
							/>
							<Button variant="solid" @click="saveEvaluation()">
								{{ __('Save') }}
							</Button>
						</div>
						<div v-else class="flex flex-col space-y-4 p-5">
							<FormControl
								type="checkbox"
								v-model="certificate.published"
								:label="__('Published')"
							/>
							<Link
								v-model="certificate.template"
								:label="__('Template')"
								doctype="Print Format"
								:filters="{
									doc_type: 'LMS Certificate',
								}"
							/>
							<FormControl
								type="date"
								v-model="certificate.issue_date"
								:label="__('Issue Date')"
							/>
							<FormControl
								type="date"
								v-model="certificate.expiry_date"
								:label="__('Expiry Date')"
							/>
							<Button variant="solid" @click="saveCertificate()">
								{{ __('Save') }}
							</Button>
						</div>
					</template>
				</Tabs>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Dialog,
	Button,
	FormControl,
	createResource,
	Tabs,
	Tooltip,
	Textarea,
	toast,
} from 'frappe-ui'
import {
	User,
	Calendar,
	Clock,
	Video,
	BookOpen,
	FileText,
	GraduationCap,
	Users,
	ClipboardList,
} from 'lucide-vue-next'
import { inject, reactive, watch, ref, computed } from 'vue'
import { formatTime } from '@/utils'
import Rating from '@/components/Controls/Rating.vue'
import Link from '@/components/Controls/Link.vue'

const show = defineModel()
const dayjs = inject('$dayjs')
const tabIndex = ref(0)
const showCertification = ref(false)

const props = defineProps({
	event: {
		type: [Object, null],
		required: true,
	},
})

const evaluation = reactive({})

const certificate = reactive({})

const defaultTemplate = createResource({
	url: 'frappe.client.get_value',
	makeParams(values) {
		return {
			doctype: 'Property Setter',
			fieldname: 'value',
			filters: {
				doc_type: 'LMS Certificate',
				property: 'default_print_format',
			},
		}
	},
	auto: true,
	onSuccess(data) {
		certificate.template = data.value
	},
})

const openCallLink = (link) => {
	window.open(link, '_blank')
}

const evaluationResource = createResource({
	url: 'lms.lms.api.save_evaluation_details',
	makeParams(values) {
		return {
			member: props.event.member,
			course: props.event.course,
			batch_name: props.event.batch_name,
			date: props.event.date,
			start_time: props.event.start_time,
			end_time: props.event.end_time,
			status: evaluation.status,
			rating: evaluation.rating,
			summary: evaluation.summary,
			evaluator: props.event.evaluator,
		}
	},
	auto: false,
	onSuccess(data) {
		evaluation.name = data.name
	},
})

const evaluationDetails = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return {
			doctype: 'LMS Certificate Evaluation',
			filters: {
				member: props.event.member,
				course: props.event.course,
			},
		}
	},
	onSuccess(data) {
		for (const key in data) {
			if (key in evaluation) evaluation[key] = data[key]
			if (key == 'rating') evaluation.rating = data.rating * 5
			if (evaluation.status == 'Pass') showCertification.value = true
		}
	},
	auto: false,
})

const saveEvaluation = () => {
	evaluationResource.submit(
		{},
		{
			onSuccess: () => {
				if (evaluation.status == 'Pass') {
					showCertification.value = true
				} else {
					show.value = false
				}
				toast.success(__('Evaluation saved successfully'))
			},
		}
	)
}

const certificateResource = createResource({
	url: 'lms.lms.api.save_certificate_details',
	makeParams(values) {
		return {
			member: props.event.member,
			course: props.event.course,
			batch_name: props.event.batch_name,
			published: certificate.published,
			issue_date: certificate.issue_date,
			expiry_date: certificate.expiry_date,
			template: certificate.template,
			evaluator: props.event.evaluator,
		}
	},
	auto: false,
	onSuccess(data) {
		certificate.name = data
	},
})

const certificateDetails = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return {
			doctype: 'LMS Certificate',
			filters: {
				member: props.event.member,
				course: props.event.course,
			},
		}
	},
	onSuccess(data) {
		for (const key in data) {
			if (key in certificate) certificate[key] = data[key]
			certificate.name = data.name
			showCertification.value = true
		}
	},
	onError(err) {
		certificate.template = defaultTemplate.data.value
	},
	auto: false,
})

const saveCertificate = () => {
	certificateResource.submit(
		{},
		{
			onSuccess: () => {
				toast.success(__('Certificate saved successfully'))
			},
		}
	)
}

watch(show, () => {
	if (show.value) {
		evaluation.rating = 0
		evaluation.status = 'Pending'
		evaluation.summary = ''
		evaluationDetails.reload()

		certificate.published = true
		certificate.issue_date = dayjs().format('YYYY-MM-DD')
		certificate.expiry_date = null
		certificate.template = null
		certificate.name = null
		certificateDetails.reload()
	}
})

const openCertificate = (certificate) => {
	window.open(
		`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
			certificate.name
		}&format=${encodeURIComponent(certificate.template)}`
	)
}

const statusOptions = computed(() => {
	return [
		{
			value: 'Pending',
			label: __('Pending'),
		},
		{
			value: 'In Progress',
			label: __('In Progress'),
		},
		{
			value: 'Pass',
			label: __('Pass'),
		},
		{
			value: 'Fail',
			label: __('Fail'),
		},
	]
})

const tabs = computed(() => {
	const tabsArray = [
		{
			label: __('Evaluation'),
			icon: ClipboardList,
		},
	]

	if (showCertification.value) {
		tabsArray.push({
			label: __('Certification'),
			icon: GraduationCap,
		})
	}

	return tabsArray
})
</script>
