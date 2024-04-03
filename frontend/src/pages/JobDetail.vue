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
		<div v-if="job.data">
			<div class="p-5 sm:p-5">
				<div class="flex mb-4">
					<img
						:src="job.data.company_logo"
						class="w-16 h-16 rounded-lg object-contain mr-4"
						:alt="job.data.company_name"
					/>
					<div>
						<div class="text-2xl font-semibold mb-2">
							{{ job.data.job_title }}
						</div>
						<div>
							{{ __('posted by') }}
							<span class="font-medium">{{ job.data.company_name }}</span>
							{{ __('on') }}
							<span class="font-medium">{{
								dayjs(job.data.creation).format('DD MMM YYYY')
							}}</span>
						</div>
						<div class="flex items-center mt-2">
							<Badge :label="job.data.type" theme="green" size="lg" />
							<Badge
								:label="job.data.location"
								theme="gray"
								size="lg"
								class="ml-4"
							>
								<template #prefix>
									<MapPin class="h-4 w-4 stroke-1.5" />
								</template>
							</Badge>
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
import { Badge, Button, Breadcrumbs, createResource } from 'frappe-ui'
import { inject, ref, onMounted } from 'vue'
import { MapPin, SendHorizonal, Pencil } from 'lucide-vue-next'
import JobApplicationModal from '@/components/Modals/JobApplicationModal.vue'

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

const openApplicationModal = () => {
	showApplicationModal.value = true
}

const redirectToLogin = (job) => {
	window.location.href = `/login?redirect-to=/job-openings/${job}`
}
</script>
