<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs :items="breadcrumbs" />
			<Button variant="solid" @click="saveJob()">
				{{ __('Save') }}
			</Button>
		</header>
		<div class="py-5">
			<div class="container border-b mb-4 pb-5">
				<div class="text-lg font-semibold mb-4 text-ink-gray-9">
					{{ __('Job Details') }}
				</div>
				<div class="grid grid-cols-2 gap-5">
					<div class="space-y-4">
						<FormControl
							v-model="job.job_title"
							:label="__('Title')"
							:required="true"
						/>
						<FormControl
							v-model="job.type"
							:label="__('Type')"
							type="select"
							:options="jobTypes"
							:required="true"
						/>
						<FormControl
							v-model="job.work_mode"
							:label="__('Work Mode')"
							type="select"
							:options="workModes"
							:required="true"
						/>
					</div>
					<div class="space-y-4">
						<FormControl
							v-model="job.location"
							:label="__('City')"
							:required="true"
						/>
						<Link
							v-model="job.country"
							doctype="Country"
							:label="__('Country')"
							:required="true"
						/>
						<FormControl
							v-if="jobName != 'new'"
							v-model="job.status"
							:label="__('Status')"
							type="select"
							:options="jobStatuses"
							:required="true"
						/>
					</div>
				</div>
			</div>
			<div class="container border-b mb-4 pb-5">
				<div class="text-lg font-semibold mb-4 text-ink-gray-9">
					{{ __('Company Details') }}
				</div>
				<div class="grid grid-cols-2 gap-5">
					<div>
						<FormControl
							v-model="job.company_name"
							:label="__('Company Name')"
							class="mb-4"
							:required="true"
						/>
						<FormControl
							v-model="job.company_website"
							:label="__('Company Website')"
							:required="true"
						/>
					</div>
					<div>
						<FormControl
							v-model="job.company_email_address"
							:label="__('Company Email Address')"
							class="mb-4"
							:required="true"
						/>
						<Uploader
							v-model="job.company_logo"
							:label="__('Company Logo')"
							:required="true"
						/>
					</div>
				</div>
			</div>
			<div class="container mt-4">
				<label class="block text-ink-gray-5 text-xs mb-1">
					{{ __('Description') }}
					<span class="text-ink-red-3">*</span>
				</label>
				<TextEditor
					:content="job.description"
					@change="(val) => (job.description = val)"
					:editable="true"
					:fixedMenu="true"
					editorClass="prose-sm max-w-none border-b border-x border-outline-gray-modals bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] mb-4"
				/>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	FormControl,
	createResource,
	Button,
	TextEditor,
	usePageMeta,
	toast,
} from 'frappe-ui'
import { computed, onMounted, reactive, inject } from 'vue'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import { escapeHTML, sanitizeHTML } from '@/utils'
import Uploader from '@/components/Controls/Uploader.vue'

const user = inject('$user')
const router = useRouter()
const { brand } = sessionStore()

const props = defineProps({
	jobName: {
		type: String,
		default: 'new',
	},
})

const newJob = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Job Opportunity',
				company_logo: job.company_logo,
				...job,
			},
		}
	},
})

const updateJob = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'Job Opportunity',
			name: props.jobName,
			fieldname: {
				company_logo: job.company_logo,
				...job,
			},
		}
	},
})

const jobDetail = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return {
			doctype: 'Job Opportunity',
			name: props.jobName,
		}
	},
	onSuccess(data) {
		if (data.owner != user.data?.name && !user.data?.is_moderator) {
			router.push({
				name: 'Jobs',
			})
		}
		Object.keys(data).forEach((key) => {
			if (Object.hasOwn(job, key)) job[key] = data[key]
		})
	},
})

const job = reactive({
	job_title: '',
	location: '',
	country: '',
	type: 'Full Time',
	work_mode: 'On-site',
	status: 'Open',
	company_name: '',
	company_website: '',
	company_logo: null,
	description: '',
	company_email_address: '',
})

onMounted(() => {
	if (!user.data) {
		router.push({
			name: 'Jobs',
		})
	}

	if (props.jobName != 'new') jobDetail.reload()
	addKeyboardShortcuts()
})

const addKeyboardShortcuts = () => {
	document.addEventListener('keydown', (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
			e.preventDefault()
			saveJob()
		}
	})
}

const saveJob = () => {
	validateJobFields()
	if (jobDetail.data) {
		editJobDetails()
	} else {
		createNewJob()
	}
}

const createNewJob = () => {
	newJob.submit(
		{},
		{
			onSuccess(data) {
				router.push({
					name: 'JobDetail',
					params: {
						job: data.name,
					},
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const editJobDetails = () => {
	updateJob.submit(
		{},
		{
			onSuccess(data) {
				router.push({
					name: 'JobDetail',
					params: {
						job: data.name,
					},
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const validateJobFields = () => {
	job.description = sanitizeHTML(job.description)
	Object.keys(job).forEach((key) => {
		if (key != 'description' && typeof job[key] === 'string') {
			job[key] = escapeHTML(job[key])
		}
	})
}

const jobTypes = computed(() => {
	return [
		{ label: 'Full Time', value: 'Full Time' },
		{ label: 'Part Time', value: 'Part Time' },
		{ label: 'Contract', value: 'Contract' },
		{ label: 'Freelance', value: 'Freelance' },
	]
})

const workModes = computed(() => {
	return [
		{ label: 'On site', value: 'On-site' },
		{ label: 'Hybrid', value: 'Hybrid' },
		{ label: 'Remote', value: 'Remote' },
	]
})

const jobStatuses = computed(() => {
	return [
		{ label: 'Open', value: 'Open' },
		{ label: 'Closed', value: 'Closed' },
	]
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: __('Jobs'),
			route: { name: 'Jobs' },
		},
		{
			label: props.jobName == 'new' ? __('New Job') : __('Edit Job'),
			route: { name: 'JobForm' },
		},
	]
	return crumbs
})

usePageMeta(() => {
	return {
		title: props.jobName == 'new' ? __('New Job') : jobDetail.data?.job_title,
		icon: brand.favicon,
	}
})
</script>
