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
						label: applications.data?.[0]?.job_title,
						route: { name: 'JobDetail', params: { job: props.job } },
					},
					{ label: __('Applications') },
				]"
			/>
		</header>
		<div class="max-w-4xl mx-auto pt-5 p-4">
			<div class="mb-6">
				<h1 class="text-xl font-semibold text-ink-gray-7 mb-4 md:mb-0">
					{{ applicationCount }}
					{{ applicationCount === 1 ? __('Application') : __('Applications') }}
				</h1>
			</div>

			<div v-if="applications.data?.length">
				<ListView
					:columns="applicationColumns"
					:rows="applicantRows"
					row-key="name"
					:options="{
						showTooltip: false,
						selectable: false,
					}"
				>
					<ListHeader
						class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
					>
						<ListHeaderItem
							:item="item"
							v-for="item in applicationColumns"
							:key="item.key"
						>
							<template #prefix="{ item }">
								<FeatherIcon
									v-if="item.icon"
									:name="item.icon?.toString()"
									class="h-4 w-4"
								/>
							</template>
						</ListHeaderItem>
					</ListHeader>
					<ListRows>
						<ListRow
							:row="row"
							v-slot="{ column, item }"
							v-for="row in applicantRows"
							class="cursor-pointer"
						>
							<ListRowItem :item="item">
								<div
									v-if="column.key === 'full_name'"
									class="flex items-center space-x-3"
								>
									<Avatar
										size="sm"
										:image="row['user_image']"
										:label="row['full_name']"
									/>

									<span>{{ item }}</span>
								</div>
								<div
									v-else-if="column.key === 'actions'"
									class="flex justify-center"
								>
									<Dropdown :options="getActionOptions(row)">
										<Button variant="ghost">
											<FeatherIcon name="more-horizontal" class="w-4 h-4" />
										</Button>
									</Dropdown>
								</div>
								<div
									v-else-if="column.key === 'applied_on'"
									class="text-sm text-ink-gray-6"
								>
									{{ item }}
								</div>
								<div v-else>
									{{ item }}
								</div>
							</ListRowItem>
						</ListRow>
					</ListRows>
				</ListView>
				<div class="flex justify-center mt-5">
					<Button v-if="applications.hasNextPage" @click="applications.next()">
						<template #prefix>
							<RefreshCw class="size-4 stroke-1.5" />
						</template>
						{{ __('Load More') }}
					</Button>
				</div>
			</div>
			<EmptyState v-else-if="!applications.loading" type="Job Applications" />
		</div>

		<Dialog
			v-model="showEmailModal"
			:options="{
				title: __('Send Email to {0}').format(selectedApplicant?.full_name),
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
						v-model="emailForm.subject"
						:label="__('Subject')"
						:placeholder="__('Enter email subject')"
						required
					/>
					<FormControl
						v-model="emailForm.replyTo"
						:label="__('Reply To')"
						:placeholder="__('Enter reply to email')"
					/>
					<div>
						<div class="text-sm text-ink-gray-5 mb-1">
							{{ __('Message') }}
						</div>
						<TextEditor
							:content="emailForm.message"
							@change="(val) => (emailForm.message = val)"
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
	Avatar,
	Button,
	Breadcrumbs,
	call,
	Dialog,
	Dropdown,
	FeatherIcon,
	FormControl,
	TextEditor,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	createResource,
	createListResource,
	usePageMeta,
	toast,
} from 'frappe-ui'
import { RefreshCw } from 'lucide-vue-next'
import { computed, inject, onMounted, ref, reactive } from 'vue'
import { sessionStore } from '../stores/session'
import EmptyState from '@/components/EmptyState.vue'

const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const showEmailModal = ref(false)
const selectedApplicant = ref(null)
const applicationCount = ref(0)
const emailForm = reactive({
	subject: '',
	message: '',
	replyTo: '',
})

const props = defineProps({
	job: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	getApplicationCount()
})

const getApplicationCount = () => {
	call('frappe.client.get_count', {
		doctype: 'LMS Job Application',
		filters: { job: props.job },
	}).then((count) => {
		applicationCount.value = count
	})
}

const applications = createListResource({
	doctype: 'LMS Job Application',
	fields: [
		'name',
		'user.user_image as user_image',
		'user.full_name as full_name',
		'user.email as email',
		'creation',
		'resume',
		'job.job_title as job_title',
	],
	filters: {
		job: props.job,
	},
	auto: true,
})

const emailResource = createResource({
	url: 'frappe.core.doctype.communication.email.make',
	makeParams(values) {
		return {
			recipients: selectedApplicant.value.email,
			cc: emailForm.replyTo,
			subject: emailForm.subject,
			content: emailForm.message,
			doctype: 'LMS Job Application',
			name: selectedApplicant.value.name,
			send_email: 1,
			now: true,
		}
	},
})

const openEmailModal = (applicant) => {
	selectedApplicant.value = applicant
	emailForm.subject = `Job Application for ${applications.data?.[0]?.job_title} - ${applicant.full_name}`
	emailForm.replyTo = ''
	emailForm.message = ''
	showEmailModal.value = true
}

const sendEmail = (close) => {
	emailResource.submit(
		{},
		{
			validate() {
				if (!emailForm.subject) {
					return __('Subject is required')
				}
				if (!emailForm.message) {
					return __('Message is required')
				}
			},
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

const getActionOptions = (row) => {
	const options = []
	if (row.resume) {
		options.push({
			label: __('View Resume'),
			icon: 'download',
			onClick: () => downloadResume(row.resume),
		})
	}
	options.push({
		label: __('Send Email'),
		icon: 'mail',
		onClick: () => openEmailModal(row),
	})
	return options
}

const applicationColumns = computed(() => {
	return [
		{
			label: __('Full Name'),
			key: 'full_name',
			width: 2,
			icon: 'user',
		},
		{
			label: __('Email'),
			key: 'email',
			width: 2,
			icon: 'at-sign',
		},
		{
			label: __('Applied On'),
			key: 'applied_on',
			width: 1,
			icon: 'calendar',
		},
		{
			label: '',
			key: 'actions',
			width: 1,
		},
	]
})

const applicantRows = computed(() => {
	if (!applications.data) return []
	return applications.data.map((application) => ({
		...application,
		full_name: application.full_name,
		applied_on: dayjs(application.creation).fromNow(),
	}))
})

usePageMeta(() => {
	return {
		title: `Applications - ${applications.data?.[0]?.job_title}`,
		icon: brand.favicon,
	}
})
</script>
