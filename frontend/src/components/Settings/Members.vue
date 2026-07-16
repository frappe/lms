<template>
	<SettingsLayout :title="__(label)" :description="__(description)">
		<template #header-actions>
			<Button variant="solid" @click="openNewMember">
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				{{ __('New') }}
			</Button>
		</template>
		<template #header-bottom>
			<div class="flex items-center justify-between gap-2 mb-4">
				<FormControl
					v-model="search"
					:placeholder="__('Search')"
					type="text"
					:debounce="300"
					class="w-1/3"
				>
					<template #prefix>
						<span class="lucide-search size-4 text-ink-gray-5" />
					</template>
				</FormControl>
				<Select v-model="currentRole" class="w-40" :options="roleOptions" />
			</div>
		</template>
		<div v-if="displayedMembers.length">
			<List class="list-row-px-3">
				<ListRows
					:items="displayedMembers"
					row-key="name"
					v-slot="{ item: member }"
				>
					<ListRow class="py-2.5" @click="openProfile(member.username)">
						<ListCell>
							<Avatar
								:image="member.user_image"
								:label="member.full_name"
								size="xl"
								class="shrink-0"
							/>
						</ListCell>
						<ListCell>
							<!-- Own flex column: ListCell's items-center would otherwise
							     center these horizontally once the cell is flex-col. -->
							<div class="flex min-w-0 flex-col">
								<span class="truncate text-p-base text-ink-gray-8">
									{{ member.full_name }}
								</span>
								<span class="truncate text-p-sm text-ink-gray-5">
									{{ member.name }}
								</span>
							</div>
						</ListCell>
						<ListCell class="gap-2" @click.stop>
							<span
								v-for="role in badgeRoles(member.roles)"
								:key="role"
								class="flex items-center gap-x-1 rounded-md bg-surface-gray-2 px-2 py-1 text-ink-gray-8"
							>
								<span class="lucide-shield size-3.5" />
								<span class="text-sm leading-5">{{ getRole(role) }}</span>
							</span>
							<Dropdown
								:options="getMemberMenuOptions(member)"
								:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
								placement="right"
							/>
						</ListCell>
					</ListRow>
				</ListRows>
			</List>
			<div
				v-if="memberList.length && hasNextPage"
				class="flex justify-center mt-4"
			>
				<Button @click="members.reload()">
					<template #prefix>
						<span class="lucide-refresh-cw h-3 w-3" />
					</template>
					{{ __('Load More') }}
				</Button>
			</div>
		</div>
		<EmptyStateLayout
			v-else
			name="Users"
			:description="__('Add one to get started.')"
			icon="lucide-user"
		/>
	</SettingsLayout>
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
import {
	Avatar,
	Button,
	call,
	createResource,
	Dialog,
	Dropdown,
	FormControl,
	Select,
	toast,
} from 'frappe-ui'
import { List, ListCell, ListRow, ListRows } from 'frappe-ui/list'
import { useRouter } from 'vue-router'
import { ref, computed, watch, inject } from 'vue'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import type { User } from '@/components/Settings/types'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
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

const displayedMembers = computed(() => memberList.value)
const memberList = ref<Member[]>([])
const hasNextPage = ref(false)
const showNewMember = ref(false)
const user = inject<User | null>('$user')
const { updateOnboardingStep } = useOnboarding('learning')
const { capture } = useTelemetry()

const showDeleteDialog = ref(false)
const memberToDelete = ref<Member | null>(null)
const memberToEdit = ref<Member | null>(null)

const props = defineProps({
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
	makeParams: () => {
		return {
			search: search.value,
			start: start.value,
			role: currentRole.value,
		}
	},
	onSuccess(data: Member[]) {
		memberList.value = memberList.value.concat(data)
		start.value = start.value + 20
		hasNextPage.value = data.length === 20
	},
	auto: true,
})

const refreshMembers = () => {
	memberList.value = []
	start.value = 0
	members.reload()
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

const onMemberCreated = (data: any) => {
	if (user?.data?.is_system_manager) updateOnboardingStep('invite_students')
	capture('user_added')
	refreshMembers()
}

watch([search, currentRole], () => {
	refreshMembers()
})

const badgeRoles = (roles?: string[]) =>
	(roles || []).filter((role) => role !== 'LMS Student')

const getRole = (role: string) => {
	const map: Record<string, string> = {
		'LMS Student': 'Student',
		'Course Creator': 'Instructor',
		Moderator: 'Moderator',
		'Batch Evaluator': 'Evaluator',
	}
	return map[role]
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

const getMemberMenuOptions = (member: Member) => [
	{
		label: __('Edit member'),
		onClick: () => openEditMember(member),
	},
	{
		label: __('Delete user'),
		theme: 'red',
		onClick: () => openDeleteDialog(member),
	},
]
</script>
