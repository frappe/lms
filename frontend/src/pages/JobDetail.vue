<template>
	<div class="">
		<PageHeader :breadcrumbs="breadcrumbs" :loading="job.loading">
			<template #actions>
				<div
					v-if="user.data?.name && !readOnlyMode"
					class="flex items-center gap-2"
				>
					<router-link
						v-if="canManageJob && applicantCount > 0"
						:to="{
							name: 'JobApplications',
							params: { job: job.data?.name },
						}"
					>
						<HeaderButton
							:label="__('View Applications')"
							icon="lucide-square-user-round"
							variant="subtle"
						/>
					</router-link>
					<router-link
						v-if="canManageJob"
						:to="{
							name: 'JobForm',
							params: { jobName: job.data?.name },
						}"
					>
						<HeaderButton
							:label="__('Edit')"
							icon="lucide-pencil"
							variant="subtle"
						/>
					</router-link>
					<HeaderButton
						:label="__('Visit Website')"
						icon="lucide-square-arrow-out-up-right"
						variant="subtle"
						@click="redirectToWebsite(job.data?.company_website)"
					/>
					<HeaderButton
						v-if="!jobApplication.data?.length"
						:label="__('Apply')"
						icon="lucide-send-horizonal"
						variant="solid"
						@click="openApplicationModal()"
					/>
					<Badge v-else variant="subtle" theme="green" size="lg">
						<template #prefix>
							<span class="lucide-check size-4" />
						</template>
						{{ __('You have applied') }}
					</Badge>
				</div>
				<HeaderButton
					v-else-if="!readOnlyMode"
					:label="__('Login to apply')"
					icon="lucide-log-in"
					variant="subtle"
					@click="redirectToLogin(job.data?.name)"
				/>
			</template>
		</PageHeader>
		<div v-if="job.data" class="max-w-3xl mx-auto pt-5">
			<div class="p-4">
				<div class="space-y-5 mb-12">
					<div class="flex">
						<a
							:href="safeUrl(job.data.company_website)"
							v-external
							class="me-4"
						>
							<img
								:src="safeUrl(job.data.company_logo)"
								class="size-10 rounded-lg object-contain cursor-pointer"
								:alt="job.data.company_name"
							/>
						</a>
						<div class="">
							<h1 class="text-xl text-ink-gray-9 font-semibold mb-1">
								{{ job.data.job_title }}
							</h1>
							<div class="text-sm text-ink-gray-5 font-semibold">
								{{ job.data.company_name }} - {{ job.data.location }},
								{{ job.data.country }}
							</div>
						</div>
					</div>

					<div class="flex items-center gap-x-2">
						<Badge size="lg">
							<template #prefix>
								<span class="lucide-calendar-days size-3 text-ink-gray-7" />
							</template>
							{{ dayjs(job.data.creation).fromNow() }}
						</Badge>
						<Badge size="lg">
							<template #prefix>
								<span class="lucide-clipboard-type size-3 text-ink-gray-7" />
							</template>
							{{ job.data.type }}
						</Badge>
						<Badge v-if="job.data?.work_mode" size="lg">
							<template #prefix>
								<span
									class="lucide-briefcase-business size-3 text-ink-gray-7"
								/>
							</template>
							{{ job.data.work_mode }}
						</Badge>
						<Badge v-if="applicantCount" size="lg">
							<template #prefix>
								<span class="lucide-square-user-round size-3 text-ink-gray-7" />
							</template>
							{{ applicantCount }}
							{{ applicantCount == 1 ? __('applicant') : __('applicants') }}
						</Badge>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<div class="bg-surface-gray-2 h-px m-1 w-1/2"></div>
					<div>
						<span class="lucide-file-text size-3 text-ink-gray-5" />
					</div>
					<div class="bg-surface-gray-2 h-px m-1 w-1/2"></div>
				</div>

				<p
					v-safe-html:rich="job.data.description"
					class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mt-12"
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
import { Badge, createResource, usePageMeta } from 'frappe-ui'
import { inject, ref, computed, watch, nextTick } from 'vue'
import { sessionStore } from '../stores/session'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import JobApplicationModal from '@/components/Modals/JobApplicationModal.vue'
import { safeUrl } from '@/utils/safeUrl'
import { openExternal } from '@/utils/openExternal'

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

const job = createResource({
	url: 'lms.lms.api.get_job_details',
	params: {
		job: props.job,
	},
	cache: ['job', props.job],
	auto: true,
})

const jobApplication = createResource({
	url: 'frappe.client.get_list',
	makeParams() {
		return {
			doctype: 'LMS Job Application',
			filters: {
				job: job.data?.name,
				user: user.data?.name,
			},
		}
	},
})

const applicantCount = computed(() => job.data?.applicants || 0)

const breadcrumbs = computed(() => [
	{
		label: __('Jobs'),
		route: { name: 'Jobs' },
	},
	{
		label: job.data?.job_title,
		route: { name: 'JobDetail', params: { job: job.data?.name } },
	},
])

const stopWatch = watch(
	() => [job.data?.name, user.data?.name],
	([jobName, userName]) => {
		if (jobName && userName) {
			jobApplication.submit()
			nextTick(() => stopWatch())
		}
	},
	{ immediate: true }
)

const openApplicationModal = () => {
	showApplicationModal.value = true
}

const redirectToLogin = (job) => {
	window.location.href = `/login?redirect-to=/job-openings/${job}`
}

// A company_website is a plain Data field, so it often arrives without a
// scheme. Left as typed it opens a path under /lms; the allowlist would reject
// it outright. Naming https keeps the link working either way.
const redirectToWebsite = (url) => {
	openExternal(/^https?:\/\//i.test(url ?? '') ? url : `https://${url}`)
}

const canManageJob = computed(() => {
	if (!user.data?.name || !job.data) return false
	return user.data.name === job.data.owner || user.data?.is_moderator
})

usePageMeta(() => {
	return {
		title: job.data?.job_title,
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
