<template>
	<SettingsList
		:title="__(label)"
		:description="__(description)"
		:columns="columns"
		:rows="memberList"
		:loading="Boolean(members.loading)"
		:has-next-page="hasNextPage"
		v-model:search="search"
		searchable
		:search-label="__('Search members')"
		empty-name="Users"
		empty-icon="lucide-user"
		@new="openNewMember"
		@load-more="fetchMembers()"
		@row-click="(member) => openProfile(member.username)"
	>
		<template #header-bottom>
			<Select
				v-model="currentRole"
				class="w-40"
				:aria-label="__('Filter by role')"
				:options="roleOptions"
			/>
		</template>
	</SettingsList>

	<NewMemberModal
		v-model="showNewMember"
		:editMember="memberToEdit"
		@created="onMemberCreated"
		@updated="refreshMembers"
	/>

	<Dialog
		v-model:open="showDeleteDialog"
		:title="
			memberToDelete ? __('Delete {0}?').format(memberToDelete.full_name) : ''
		"
		:message="
			__('This permanently deletes the user account and cannot be undone.')
		"
		size="sm"
		:actions="[
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick: confirmDelete,
			},
			{
				label: __('Cancel'),
				onClick: () => {
					showDeleteDialog = false
				},
			},
		]"
	/>
</template>
<script setup lang="ts">
import { call, createResource, Dialog, Select, toast } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ref, watch, inject } from 'vue'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import type { SettingsListColumn, User } from '@/types'
import { SETTINGS_PAGE_LENGTH } from '@/composables/useSettingsListResource'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { cleanError } from '@/utils'

type Member = {
	username: string
	full_name: string
	name: string
	roles?: string[]
	user_image?: string
}

const router = useRouter()
const show = defineModel('show')
const search = ref('')
const currentRole = ref('All')
const start = ref(0)

const roleOptions = [
	{ label: __('All'), value: 'All' },
	{ label: __('Student'), value: 'LMS Student' },
	{ label: __('Instructor'), value: 'Course Creator' },
	{ label: __('Moderator'), value: 'Moderator' },
	{ label: __('Evaluator'), value: 'Batch Evaluator' },
]

const memberList = ref<Member[]>([])
const hasNextPage = ref(false)
const showNewMember = ref(false)
const user = inject<User | null>('$user')
const { updateOnboardingStep } = useOnboarding('learning')
const { capture } = useTelemetry()

const showDeleteDialog = ref(false)
const memberToDelete = ref<Member | null>(null)
const memberToEdit = ref<Member | null>(null)

defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		default: '',
	},
})

const members = createResource({
	url: 'lms.lms.api.get_members',
	makeParams: () => ({
		search: search.value,
		start: start.value,
		role: currentRole.value,
	}),
	auto: false,
})

// createResource carries no request sequence and aborts nothing, so two calls
// in flight both resolve and both append: a role change mid-request would show
// one filter's page under another's, and over-advance `start` past rows nobody
// ever saw. Each call takes a token and a superseded response is dropped.
let requestToken = 0

const fetchMembers = async () => {
	const token = ++requestToken
	const data = (await members.reload()) as Member[] | null
	if (token !== requestToken || !data) return
	memberList.value = memberList.value.concat(data)
	// Paged by what the server actually returned, not by the constant. An
	// exact-equality check hides Load More outright the moment the two
	// disagree, and stepping `start` by the constant would then skip rows.
	start.value = start.value + data.length
	hasNextPage.value = data.length >= SETTINGS_PAGE_LENGTH
}

// The search goes to the server with start reset, so a match past the first
// page is reachable without pressing Load More first.
const refreshMembers = () => {
	memberList.value = []
	start.value = 0
	return fetchMembers()
}

watch([search, currentRole], () => {
	refreshMembers()
})

refreshMembers()

const roleLabels: Record<string, string> = {
	'LMS Student': __('Student'),
	'Course Creator': __('Instructor'),
	Moderator: __('Moderator'),
	'Batch Evaluator': __('Evaluator'),
}

const openProfile = (username: string) => {
	show.value = false
	router.push({
		name: 'Profile',
		params: {
			username: username,
		},
	})
}

const onMemberCreated = () => {
	if (user?.data?.is_system_manager) updateOnboardingStep('invite_students')
	capture('user_added')
	refreshMembers()
}

const openEditMember = (member: Member) => {
	memberToEdit.value = member
	showNewMember.value = true
}

const openNewMember = () => {
	memberToEdit.value = null
	showNewMember.value = true
}

const openDeleteDialog = (member: Member) => {
	memberToDelete.value = member
	showDeleteDialog.value = true
}

const columns: SettingsListColumn[] = [
	{
		key: 'member',
		label: __('User'),
		type: 'stacked',
		primary: (row) => row.full_name,
		secondary: (row) => row.name,
		avatar: (row) => ({ image: row.user_image, label: row.full_name }),
	},
	{
		key: 'roles',
		label: __('Roles'),
		type: 'badge',
		badges: (row) =>
			((row.roles || []) as string[])
				.filter((role) => roleLabels[role])
				.map((role) => ({ label: roleLabels[role], theme: 'gray' as const })),
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.full_name),
		options: (row) => [
			{
				label: __('Edit member'),
				onClick: () => openEditMember(row as Member),
			},
			{
				label: __('Delete user'),
				theme: 'red',
				onClick: () => openDeleteDialog(row as Member),
			},
		],
	},
]

const confirmDelete = async (close: () => void) => {
	if (!memberToDelete.value) return
	try {
		await call('lms.lms.api.delete_member', { user: memberToDelete.value.name })
		showDeleteDialog.value = false
		memberToDelete.value = null
		refreshMembers()
		toast.success(__('User deleted'))
	} catch (err: any) {
		toast.error(cleanError(err.messages?.[0]) || err)
	}
	close?.()
}
</script>
