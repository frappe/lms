<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[
					{ label: __('Jobs'), route: { name: 'Jobs' } },
					{
						label: job.data?.job_title,
						route: { name: 'JobDetail', params: { job: job.data?.name } },
					},
					{ label: __('Applications') },
				]"
			/>
		</header>
		<div v-if="job.data" class="max-w-4xl mx-auto pt-5 p-4">
			<div class="mb-6">
				<h1 class="text-2xl font-semibold text-ink-gray-9 mb-2">
					{{ __('Applications for {0}').format(job.data.job_title) }}
				</h1>
				<p class="text-ink-gray-6">
					{{ applications.data?.length || 0 }}
					{{
						applications.data?.length === 1
							? __('application')
							: __('applications')
					}}
				</p>
			</div>

			<div v-if="applications.data?.length" class="space-y-4">
				<div
					v-for="application in applications.data"
					:key="application.name"
					class="border rounded-lg p-4 hover:border-outline-gray-3"
				>
					<div class="flex items-start justify-between">
						<div class="flex items-center space-x-3">
							<img
								v-if="application.user_image"
								:src="application.user_image"
								:alt="application.full_name"
								class="w-10 h-10 rounded-full object-cover"
							/>
							<div
								v-else
								class="w-10 h-10 rounded-full bg-surface-gray-3 flex items-center justify-center"
							>
								<User class="w-5 h-5 text-ink-gray-6" />
							</div>
							<div>
								<h3 class="font-medium text-ink-gray-9">
									{{ application.full_name || application.user }}
								</h3>
								<p class="text-sm text-ink-gray-6">{{ application.email }}</p>
								<p class="text-xs text-ink-gray-5 mt-1">
									{{
										__('Applied on {0}').format(
											dayjs(application.creation).format('MMM DD, YYYY')
										)
									}}
								</p>
							</div>
						</div>
						<div class="flex items-center space-x-2">
							<Button
								v-if="application.resume_url"
								@click="downloadResume(application.resume_url)"
								variant="outline"
								size="sm"
							>
								<template #prefix>
									<Download class="w-4 h-4" />
								</template>
								{{ __('Resume') }}
							</Button>
							<Button
								@click="openEmailModal(application)"
								variant="solid"
								size="sm"
							>
								<template #prefix>
									<Mail class="w-4 h-4" />
								</template>
								{{ __('Email') }}
							</Button>
						</div>
					</div>
				</div>
			</div>
			<EmptyState v-else type="Applications" />
		</div>

		<Dialog
			v-model="showEmailModal"
			:options="{
				title: __('Send Email to {0}').format(
					selectedApplicant?.full_name || selectedApplicant?.user
				),
				size: 'lg',
				actions: [
					{
						label: __('Send'),
						variant: 'solid',
						onClick: (close) => sendEmail(close),
					},
				],
			}"
		>
			<template #body-content>
				<div class="space-y-4">
					<FormControl
						v-model="emailSubject"
						:label="__('Subject')"
						:placeholder="__('Enter email subject')"
						required
					/>
					<div>
						<div class="text-sm text-ink-gray-5 mb-1">
							{{ __('Message') }}
						</div>
						<TextEditor
							:content="emailMessage"
							@change="(val) => (emailMessage = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
						/>
					</div>
				</div>
			</template>
		</Dialog>
	</div>
</template>

<script setup>
import {
	Button,
	Breadcrumbs,
	Dialog,
	FormControl,
	TextEditor,
	createResource,
	usePageMeta,
	toast,
} from 'frappe-ui'
import { User, Download, Mail } from 'lucide-vue-next'
import { inject, ref } from 'vue'
import { sessionStore } from '../stores/session'
import EmptyState from '@/components/EmptyState.vue'

const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const showEmailModal = ref(false)
const selectedApplicant = ref(null)
const emailSubject = ref('')
const emailMessage = ref('')

const props = defineProps({
	job: {
		type: String,
		required: true,
	},
})

const job = createResource({
	url: 'lms.lms.api.get_job_details',
	params: { job: props.job },
	cache: ['job', props.job],
	auto: true,
	onSuccess: () => {
		applications.submit()
	},
})

const applications = createResource({
	url: 'lms.lms.api.get_job_applications',
	params: { job: props.job },
	auto: true,
})

const emailResource = createResource({
	url: 'lms.lms.api.send_email_to_applicant',
})

const openEmailModal = (applicant) => {
	selectedApplicant.value = applicant
	emailSubject.value = `Job Application for ${job.data?.job_title} - ${
		applicant.full_name || applicant.user
	}`
	emailMessage.value = ''
	showEmailModal.value = true
}

const sendEmail = (close) => {
	if (!emailSubject.value || !emailMessage.value) {
		toast.error(__('Please fill in all fields'))
		return
	}

	emailResource.submit(
		{
			applicant_email: selectedApplicant.value.email,
			subject: emailSubject.value,
			message: emailMessage.value,
			job: props.job,
		},
		{
			onSuccess: () => {
				toast.success(__('Email sent successfully'))
				close()
			},
			onError: (err) => {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const downloadResume = (resumeUrl) => {
	window.open(resumeUrl, '_blank')
}

usePageMeta(() => {
	return {
		title: job.data
			? `Applications - ${job.data.job_title}`
			: 'Job Applications',
		icon: brand.favicon,
	}
})
</script>
