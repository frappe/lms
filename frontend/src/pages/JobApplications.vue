<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="applicationCountLabel"
		layout="list"
		:columns="applicationColumns"
		:rows="applicantRows"
		:loading="applications.loading"
		:total-count="totalApplications.data ?? null"
		:has-next-page="applications.hasNextPage"
		:list-options="{ showTooltip: false, selectable: false }"
		v-model:page-length="pageLength"
		empty-name="Job Applications"
		empty-icon="lucide-briefcase"
		@load-more="applications.next()"
	>
		<template #filters>
			<FormControl
				v-model="search"
				type="text"
				:placeholder="__('Search')"
				:aria-label="__('Search applications')"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
		</template>

		<template #cell="{ column, row, value }">
			<div v-if="column.key === 'full_name'" class="flex items-center gap-x-3">
				<Avatar
					size="sm"
					:image="row['user_image']"
					:label="row['full_name']"
				/>
				<span class="truncate">{{ value }}</span>
			</div>
			<Dropdown
				v-else-if="column.key === 'actions'"
				:options="getActionOptions(row)"
			>
				<Button variant="ghost" :label="__('More actions')">
					<template #icon>
						<span class="lucide-more-horizontal size-4" />
					</template>
				</Button>
			</Dropdown>
			<div
				v-else-if="column.key === 'applied_on'"
				class="text-sm text-ink-gray-6"
			>
				{{ value }}
			</div>
			<div v-else>
				{{ value }}
			</div>
		</template>
	</ListPage>

	<Dialog
		v-model="showEmailModal"
		:title="__('Send Email to {0}').format(selectedApplicant?.full_name)"
		size="lg"
		:actions="[
			{
				label: __('Send'),
				variant: 'solid',
				onClick: (close) => sendEmail(close),
			},
		]"
	>
		<template #default>
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
					<RichTextEditor
						:content="emailForm.message"
						@change="(val) => (emailForm.message = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x border-outline-elevation-2 bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import {
	Avatar,
	Button,
	call,
	Dialog,
	Dropdown,
	FormControl,
	createResource,
	createListResource,
	usePageMeta,
	toast,
} from 'frappe-ui'
import { computed, inject, ref, reactive, watch } from 'vue'
import { sessionStore } from '../stores/session'
import ListPage from '@/components/Layouts/ListPage.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { openExternal } from '@/utils/openExternal'

const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const showEmailModal = ref(false)
const selectedApplicant = ref(null)
const search = ref('')
const pageLength = ref(24)
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

const applications = createListResource({
	doctype: 'LMS Job Application',
	fields: ['name', 'user', 'creation', 'resume', 'job_title'],
	filters: {
		job: props.job,
	},
	pageLength: 24,
	auto: true,
})

watch(pageLength, (value) => {
	applications.pageLength = value
	applications.reload()
})

const users = createResource({
	url: 'lms.lms.api.get_application_users',
	makeParams: () => ({
		user_names: (applications.data || []).map((a) => a.user),
	}),
})

watch(
	() => applications.data,
	(rows) => {
		if (rows?.length) users.submit()
	}
)

const totalApplications = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Job Application',
		filters: {
			job: props.job,
		},
	},
	auto: true,
	cache: ['totalApplications', props.job],
	onError(err) {
		toast.error(err.messages?.[0] || err)
		console.error('Error fetching total applications:', err)
	},
})

watch(search, () => {
	let filters = {
		job: props.job,
		user: ['like', `%${search.value}%`],
	}
	applications.update({
		filters: filters,
	})
	applications.reload()
	totalApplications.update({
		filters: filters,
	})
	totalApplications.reload()
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
	openExternal(resumeUrl)
}

const getActionOptions = (row) => {
	const options = []
	if (row.resume) {
		options.push({
			label: __('View Resume'),
			icon: 'lucide-download',
			onClick: () => downloadResume(row.resume),
		})
	}
	options.push({
		label: __('Send Email'),
		icon: 'lucide-mail',
		onClick: () => openEmailModal(row),
	})
	return options
}

const breadcrumbs = computed(() => [
	{ label: __('Jobs'), route: { name: 'Jobs' } },
	{
		label: applications.data?.[0]?.job_title,
		route: { name: 'JobDetail', params: { job: props.job } },
	},
	{ label: __('Applications') },
])

const applicationCountLabel = computed(() => {
	const count = totalApplications.data ?? 0
	return `${count} ${count === 1 ? __('Application') : __('Applications')}`
})

const applicationColumns = computed(() => {
	return [
		{
			label: __('Full Name'),
			key: 'full_name',
			width: 3,
			icon: 'lucide-user',
		},
		{
			label: __('Email'),
			key: 'email',
			width: 3,
			icon: 'lucide-at-sign',
		},
		{
			label: __('Applied On'),
			key: 'applied_on',
			width: 2,
			icon: 'lucide-calendar',
		},
		{
			label: '',
			key: 'actions',
			width: 1,
			align: 'left',
			kind: 'actions',
		},
	]
})

const applicantRows = computed(() => {
	if (!applications.data) return []
	const userMap = Object.fromEntries((users.data || []).map((u) => [u.name, u]))
	return applications.data.map((application) => {
		const user = userMap[application.user] || {}
		return {
			...application,
			user_image: user.user_image,
			full_name: user.full_name,
			email: user.email,
			applied_on: dayjs(application.creation).format('DD MMM YYYY'),
		}
	})
})

usePageMeta(() => {
	return {
		title: `Applications - ${applications.data?.[0]?.job_title}`,
		icon: brand.favicon,
	}
})
</script>
