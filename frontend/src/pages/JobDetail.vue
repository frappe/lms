<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[
					{
						label: __('Jobs'),
						route: { name: 'Jobs' },
					},
					{
						label: job.doc?.job_title,
						route: { name: 'JobDetail', params: { job: job.doc?.name } },
					},
				]"
			/>
			<div
				v-if="user.data?.name && !readOnlyMode"
				class="flex items-center space-x-2"
			>
				<router-link
					v-if="canManageJob && applicationCount.data > 0"
					:to="{
						name: 'JobApplications',
						params: { job: job.doc?.name },
					}"
				>
					<Button variant="subtle">
						{{ __('View Applications') }}
					</Button>
				</router-link>
				<router-link
					v-if="canManageJob"
					:to="{
						name: 'JobForm',
						params: { jobName: job.doc?.name },
					}"
				>
					<Button>
						<template #prefix>
							<Pencil class="h-4 w-4 stroke-1.5" />
						</template>
						{{ __('Edit') }}
					</Button>
				</router-link>
				<Button @click="redirectToWebsite(job.doc?.company_website)">
					<template #prefix>
						<SquareArrowOutUpRight class="h-4 w-4 stroke-1.5" />
					</template>
					{{ __('Visit Website') }}
				</Button>
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
				<Badge v-else variant="subtle" theme="green" size="lg">
					<template #prefix>
						<Check class="h-4 w-4" />
					</template>
					{{ __('You have applied') }}
				</Badge>
			</div>
			<div v-else-if="!readOnlyMode">
				<Button @click="redirectToLogin(job.doc?.name)">
					<span>
						{{ __('Login to apply') }}
					</span>
				</Button>
			</div>
		</header>
		<div v-if="job.doc" class="max-w-3xl mx-auto pt-5">
			<div class="p-4">
				<div class="space-y-5 mb-12">
					<div class="flex">
						<img
							:src="job.doc.company_logo"
							class="size-10 rounded-lg object-contain cursor-pointer mr-4"
							:alt="job.doc.company_name"
							@click="redirectToWebsite(job.doc.company_website)"
						/>
						<div class="">
							<div class="text-2xl text-ink-gray-9 font-semibold mb-1">
								{{ job.doc.job_title }}
							</div>
							<div class="text-sm text-ink-gray-5 font-semibold">
								{{ job.doc.company_name }} - {{ job.doc.location }},
								{{ job.doc.country }}
							</div>
						</div>
					</div>

					<div class="space-x-2">
						<Badge size="lg">
							<template #prefix>
								<CalendarDays class="size-3 stroke-2 text-ink-gray-7" />
							</template>
							{{ dayjs(job.doc.creation).fromNow() }}
						</Badge>
						<Badge size="lg">
							<template #prefix>
								<ClipboardType class="size-3 stroke-2 text-ink-gray-7" />
							</template>
							{{ job.doc.type }}
						</Badge>
						<Badge v-if="job.doc?.work_mode" size="lg">
							<template #prefix>
								<BriefcaseBusiness class="size-3 stroke-2 text-ink-gray-7" />
							</template>
							{{ job.doc.work_mode }}
						</Badge>
						<Badge v-if="applicationCount.data" size="lg">
							<template #prefix>
								<SquareUserRound class="size-3 stroke-2 text-ink-gray-7" />
							</template>
							{{ applicationCount.data }}
							{{
								applicationCount.data == 1 ? __('applicant') : __('applicants')
							}}
						</Badge>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<div class="bg-surface-gray-2 h-px m-1 w-1/2"></div>
					<div>
						<FileText class="size-3 stroke-1 text-ink-gray-5" />
					</div>
					<div class="bg-surface-gray-2 h-px m-1 w-1/2"></div>
				</div>

				<p
					v-html="job.doc.description"
					class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mt-12"
				></p>
			</div>
			<JobApplicationModal
				v-model="showApplicationModal"
				v-model:application="jobApplication"
				:job="job.doc.name"
			/>
		</div>
	</div>
</template>
<script setup>
import {
	Badge,
	Button,
	Breadcrumbs,
	createResource,
	createDocumentResource,
	usePageMeta,
} from 'frappe-ui'
import { inject, ref, computed } from 'vue'
import { sessionStore } from '../stores/session'
import JobApplicationModal from '@/components/Modals/JobApplicationModal.vue'
import {
	Check,
	SendHorizonal,
	Pencil,
	CalendarDays,
	SquareUserRound,
	SquareArrowOutUpRight,
	FileText,
	ClipboardType,
	BriefcaseBusiness,
	Users,
} from 'lucide-vue-next'

const user = inject('$user')
const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const showApplicationModal = ref(false)
const readOnlyMode = window.read_only_mode

const props = defineProps({
	job: {
		type: String,
		required: true,
	},
})

const job = createDocumentResource({
	doctype: 'Job Opportunity',
	name: props.job,
	auto: true,
	cache: ['job', props.job],
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
				job: job.doc?.name,
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
				job: job.doc?.name,
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

const redirectToWebsite = (url) => {
	window.open(url, '_blank')
}

const canManageJob = computed(() => {
	if (!user.data?.name || !job.doc) return false
	return user.data.name === job.doc.owner || user.data?.is_moderator
})

usePageMeta(() => {
	return {
		title: job.doc?.job_title,
		icon: brand.favicon,
	}
})
</script>
<style>
p {
	margin-bottom: 0.5rem !important;
	line-height: 1.5;
}
p span {
	line-height: 1.5;
}
</style>
