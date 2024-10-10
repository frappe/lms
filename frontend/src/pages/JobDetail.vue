<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[
					{
						label: __('Jobs'),
						route: { name: 'Jobs' },
					},
					{
						label: job.data?.job_title,
						route: { name: 'JobDetail', params: { job: job.data?.name } },
					},
				]"
			/>
			<div v-if="user.data?.name" class="flex">
				<router-link
					v-if="user.data.name == job.data?.owner"
					:to="{
						name: 'JobCreation',
						params: { jobName: job.data?.name },
					}"
				>
					<Button class="mr-2">
						<template #prefix>
							<Pencil class="h-4 w-4 stroke-1.5" />
						</template>
						{{ __('Edit') }}
					</Button>
				</router-link>
				<Button
					v-if="!jobApplication.data?.length"
					variant="solid"
					@click="openApplicationModal()"
				>
					<template #prefix>
						<SendHorizonal class="h-4 w-4" />
					</template>
					{{ __('Apply') }}
				</Button>
			</div>
			<div v-else>
				<Button @click="redirectToLogin(job.data?.name)">
					<span>
						{{ __('Login to apply') }}
					</span>
				</Button>
			</div>
		</header>
		<div v-if="job.data" class="max-w-3xl mx-auto">
			<div class="p-4">
				<div class="space-y-5 mb-10">
					<div class="flex items-center">
						<img
							:src="job.data.company_logo"
							class="w-16 h-16 rounded-lg object-contain mr-4"
							:alt="job.data.company_name"
						/>
						<div class="text-2xl font-semibold mb-4">
							{{ job.data.job_title }}
						</div>
					</div>
					<div>
						<div
							class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-5 md:gap-y-5"
						>
							<div class="flex items-center space-x-2">
								<span class="p-4 bg-green-50 rounded-full">
									<Building2 class="h-4 w-4 text-green-500" />
								</span>
								<div class="flex flex-col space-y-2">
									<span class="text-xs text-gray-600 font-medium uppercase">
										{{ __('Organisation') }}
									</span>
									<span class="text-sm font-semibold">
										{{ job.data.company_name }}
									</span>
								</div>
							</div>
							<div class="flex items-center space-x-2">
								<span class="p-4 bg-red-50 rounded-full">
									<MapPin class="h-4 w-4 text-red-500" />
								</span>
								<div class="flex flex-col space-y-2">
									<span class="text-xs text-gray-600 font-medium uppercase">
										{{ __('Location') }}
									</span>
									<span class="text-sm font-semibold">
										{{ job.data.location }}
									</span>
								</div>
							</div>
							<div class="flex items-center space-x-2">
								<span class="p-4 bg-yellow-50 rounded-full">
									<ClipboardType class="h-4 w-4 text-yellow-500" />
								</span>
								<div class="flex flex-col space-y-2">
									<span class="text-xs font-medium text-gray-600 uppercase">
										{{ __('Category') }}
									</span>
									<span class="text-sm font-semibold">
										{{ job.data.type }}
									</span>
								</div>
							</div>
							<div class="flex items-center space-x-2">
								<span class="p-4 bg-blue-50 rounded-full">
									<CalendarDays class="h-4 w-4 text-blue-500" />
								</span>
								<div class="flex flex-col space-y-2">
									<span class="text-xs text-gray-600 font-medium uppercase">
										{{ __('Posted on') }}
									</span>
									<span class="text-sm font-semibold">
										{{ dayjs(job.data.creation).format('DD MMM YYYY') }}
									</span>
								</div>
							</div>
							<div
								v-if="applicationCount.data"
								class="flex items-center space-x-2"
							>
								<span class="p-4 bg-purple-50 rounded-full">
									<SquareUserRound class="h-4 w-4 text-purple-500" />
								</span>
								<div class="flex flex-col space-y-2">
									<span class="text-xs text-gray-600 font-medium uppercase">
										{{ __('Applications Received') }}
									</span>
									<span class="text-sm font-semibold">
										{{ applicationCount.data }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
				<p
					v-html="job.data.description"
					class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal mt-6"
				></p>
			</div>
			<JobApplicationModal
				v-model="showApplicationModal"
				v-model:application="jobApplication"
				:job="job.data.name"
			/>
		</div>
	</div>
</template>
<script setup>
import { Button, Breadcrumbs, createResource } from 'frappe-ui'
import { inject, ref, computed } from 'vue'
import { updateDocumentTitle } from '@/utils'
import JobApplicationModal from '@/components/Modals/JobApplicationModal.vue'
import {
	MapPin,
	SendHorizonal,
	Pencil,
	Building2,
	CalendarDays,
	ClipboardType,
	SquareUserRound,
} from 'lucide-vue-next'

const user = inject('$user')
const dayjs = inject('$dayjs')
const showApplicationModal = ref(false)

const props = defineProps({
	job: {
		type: String,
		required: true,
	},
})

const job = createResource({
	url: 'lms.lms.api.get_job_details',
	params: {
		job: props.job,
	},
	cache: ['job', props.job],
	auto: true,
	onSuccess: (data) => {
		if (user.data?.name) {
			jobApplication.submit()
		}
		applicationCount.submit()
	},
})

const jobApplication = createResource({
	url: 'frappe.client.get_list',
	makeParams(values) {
		return {
			doctype: 'LMS Job Application',
			filters: {
				job: job.data?.name,
				user: user.data?.name,
			},
		}
	},
})

const applicationCount = createResource({
	url: 'frappe.client.get_count',
	makeParams(values) {
		return {
			doctype: 'LMS Job Application',
			filters: {
				job: job.data?.name,
			},
		}
	},
})

const openApplicationModal = () => {
	showApplicationModal.value = true
}

const redirectToLogin = (job) => {
	window.location.href = `/login?redirect-to=/job-openings/${job}`
}

const pageMeta = computed(() => {
	return {
		title: job.data?.job_title,
		description: job.data?.description,
	}
})

updateDocumentTitle(pageMeta)
</script>
