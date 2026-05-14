<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs :items="breadcrumbs" />
			<div class="flex items-center gap-x-2">
				<Badge v-if="isDirty" theme="orange">
					{{ __('Not Saved') }}
				</Badge>
				<Button variant="solid" @click="saveJob()">
					{{ __('Save') }}
				</Button>
			</div>
		</header>
		<div class="">
			<div class="grid grid-cols-[70%,30%] gap-5 px-5">
				<div class="space-y-5 pt-5">
					<div class="text-ink-gray-9 font-semibold">
						{{ __('Job Details') }}
					</div>
					<div class="grid grid-cols-3 gap-5">
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
					<div>
						<label class="block text-ink-gray-5 text-xs mb-1">
							{{ __('Description') }}
							<span class="text-ink-red-3">*</span>
						</label>
						<TextEditor
							:content="job.description"
							@change="(val) => (job.description = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x border-outline-gray-modals bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[20rem] max-h-[70vh] overflow-y-auto mb-4"
						/>
					</div>
				</div>
				<div class="border-s h-[93vh]">
					<div v-if="jobName != 'new'" class="p-5 space-y-5 border-b">
						<FormControl
							v-model="job.status"
							:label="__('Status')"
							type="select"
							:options="jobStatuses"
							:required="true"
						/>
					</div>
					<div class="p-5 space-y-5 border-b">
						<div class="text-ink-gray-9 font-semibold">
							{{ __('Location') }}
						</div>
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
					</div>
					<div class="p-5 space-y-5">
						<div class="text-ink-gray-9 font-semibold">
							{{ __('Company Details') }}
						</div>
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
		</div>
	</div>
</template>
<script setup>
import {
	Badge,
	Breadcrumbs,
	call,
	FormControl,
	createDocumentResource,
	Button,
	TextEditor,
	usePageMeta,
	toast,
} from 'frappe-ui'
import {
	computed,
	inject,
	onMounted,
	onBeforeUnmount,
	reactive,
	ref,
	watch,
} from 'vue'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import { sanitizeHTML } from '@/utils'
import Uploader from '@/components/Controls/Uploader.vue'

const user = inject('$user')
const router = useRouter()
const { brand } = sessionStore()
const isDirty = ref(false)
const originalJobData = ref(null)

const props = defineProps({
	jobName: {
		type: String,
		default: 'new',
	},
})

onMounted(() => {
	if (!user.data) {
		router.push({
			name: 'Jobs',
		})
	}

	if (props.jobName != 'new') jobDetails.reload()
	window.addEventListener('keydown', keyboardShortcut)
})

const job = reactive({
	job_title: '',
	type: '',
	work_mode: '',
	location: '',
	country: '',
	status: 'Open',
	description: '',
	company_name: '',
	company_website: '',
	company_email_address: '',
	company_logo: '',
})

const jobDetails = createDocumentResource({
	doctype: 'Job Opportunity',
	name: props.jobName != 'new' ? props.jobName : undefined,
	onError(err) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
	auto: props.jobName != 'new',
})

watch(
	() => jobDetails?.doc,
	() => {
		if (!jobDetails.doc) return
		if (jobDetails.doc.owner != user.data?.name && !user.data?.is_moderator) {
			router.push({
				name: 'Jobs',
			})
		}

		if (jobDetails.doc) {
			Object.assign(job, jobDetails.doc)
			originalJobData.value = JSON.parse(JSON.stringify(jobDetails.doc))
		}
	}
)

watch(
	job,
	() => {
		isDirty.value = Object.keys(job).some((key) => {
			return job[key] != originalJobData.value?.[key]
		})
	},
	{ deep: true }
)

const saveJob = () => {
	validateJobFields()
	if (jobDetails?.doc) {
		editJobDetails()
	} else {
		createNewJob()
	}
}

const createNewJob = () => {
	call('frappe.client.insert', {
		doc: {
			doctype: 'Job Opportunity',
			company_logo: job.company_logo,
			...job,
		},
	})
		.then((data) => {
			router.push({
				name: 'JobDetail',
				params: {
					job: data.name,
				},
			})
		})
		.catch((err) => {
			toast.error(err.messages?.[0] || err)
			console.error(err)
		})
}

const editJobDetails = () => {
	jobDetails.setValue.submit(
		{
			company_logo: job.company_logo,
			...job,
		},
		{
			onSuccess(data) {
				jobDetails.reload()
				router.push({
					name: 'JobDetail',
					params: {
						job: props.jobName,
					},
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
				console.error(err)
			},
		}
	)
}

const validateJobFields = () => {
	Object.keys(job).forEach((key) => {
		if (typeof job[key] === 'string') {
			job[key] = sanitizeHTML(job[key])
		}
	})
}

const keyboardShortcut = (e) => {
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
		e.preventDefault()
		saveJob()
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
})

const jobTypes = computed(() => {
	return [
		{ label: __('Full Time'), value: 'Full Time' },
		{ label: __('Part Time'), value: 'Part Time' },
		{ label: __('Contract'), value: 'Contract' },
		{ label: __('Freelance'), value: 'Freelance' },
	]
})

const workModes = computed(() => {
	return [
		{ label: __('On site'), value: 'On-site' },
		{ label: __('Hybrid'), value: 'Hybrid' },
		{ label: __('Remote'), value: 'Remote' },
	]
})

const jobStatuses = computed(() => {
	return [
		{ label: __('Open'), value: 'Open' },
		{ label: __('Closed'), value: 'Closed' },
	]
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: __('Jobs'),
			route: { name: 'Jobs' },
		},
		{
			label: props.jobName == 'new' ? __('New Job') : jobDetails.doc?.job_title,
			route:
				props.jobName == 'new'
					? {}
					: { name: 'JobDetail', params: { job: props.jobName } },
		},
	]
	return crumbs
})

usePageMeta(() => {
	return {
		title: props.jobName == 'new' ? __('New Job') : jobDetails.doc?.job_title,
		icon: brand.favicon,
	}
})
</script>
