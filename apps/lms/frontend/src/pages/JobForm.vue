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
				<div class="text-lg font-semibold mb-4">
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
				<div class="text-lg font-semibold mb-4">
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
						<label class="block text-ink-gray-5 text-xs mb-1 mt-4">
							{{ __('Company Logo') }}
							<span class="text-ink-red-3">*</span>
						</label>
						<FileUploader
							v-if="!job.image"
							:fileTypes="['image/*']"
							:validateFile="validateFile"
							@success="(file) => saveImage(file)"
						>
							<template
								v-slot="{ file, progress, uploading, openFileSelector }"
							>
								<div class="mb-4">
									<Button @click="openFileSelector" :loading="uploading">
										{{
											uploading ? `Uploading ${progress}%` : 'Upload an image'
										}}
									</Button>
								</div>
							</template>
						</FileUploader>
						<div v-else class="">
							<div class="flex items-center">
								<div class="border rounded-md p-2 mr-2">
									<FileText class="h-5 w-5 stroke-1.5 text-ink-gray-7" />
								</div>
								<div class="flex flex-col">
									<span>
										{{ job.image.file_name }}
									</span>
									<span class="text-sm text-ink-gray-4 mt-1">
										{{ getFileSize(job.image.file_size) }}
									</span>
								</div>
								<X
									@click="removeImage()"
									class="bg-surface-gray-3 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
								/>
							</div>
						</div>
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
					editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] mb-4"
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
	FileUploader,
	usePageMeta,
	toast,
} from 'frappe-ui'
import { computed, onMounted, reactive, inject } from 'vue'
import { FileText, X } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import { getFileSize } from '@/utils'

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
				company_logo: job.image?.file_url,
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
				company_logo: job.image.file_url,
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
		Object.keys(data).forEach((key) => {
			if (Object.hasOwn(job, key)) job[key] = data[key]
		})
		if (data.company_logo) imageResource.reload({ image: data.company_logo })
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
		job.image = data
	},
})

const job = reactive({
	job_title: '',
	location: '',
	country: '',
	type: 'Full Time',
	status: 'Open',
	company_name: '',
	company_website: '',
	image: null,
	description: '',
	company_email_address: '',
})

onMounted(() => {
	if (!user.data) window.location.href = '/login'

	if (props.jobName != 'new') jobDetail.reload()
})

const saveJob = () => {
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

const saveImage = (file) => {
	job.image = file
}

const removeImage = () => {
	job.image = null
}

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png'].includes(extension)) {
		return 'Only image file is allowed.'
	}
}

const jobTypes = computed(() => {
	return [
		{ label: 'Full Time', value: 'Full Time' },
		{ label: 'Part Time', value: 'Part Time' },
		{ label: 'Contract', value: 'Contract' },
		{ label: 'Freelance', value: 'Freelance' },
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
			label: 'Jobs',
			route: { name: 'Jobs' },
		},
		{
			label: props.jobName == 'new' ? 'New Job' : 'Edit Job',
			route: { name: 'JobForm' },
		},
	]
	return crumbs
})

usePageMeta(() => {
	return {
		title: props.jobName == 'new' ? 'New Job' : jobDetail.data?.title,
		icon: brand.favicon,
	}
})
</script>
