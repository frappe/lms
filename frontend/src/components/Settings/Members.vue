<template>
	<SettingsLayout :title="__(label)" :description="__(description)">
		<template #header-actions>
			<Button variant="solid" @click="openNewMember">
				<template #prefix>
					<Plus class="h-4 w-4 stroke-1.5" />
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
						<Search class="size-4 stroke-1.5 text-ink-gray-5" />
					</template>
				</FormControl>
				<Select v-model="currentRole" class="w-40" :options="roleOptions" />
			</div>
		</template>
		<div class="pb-4">
			<div>
				<ul class="divide-y divide-outline-gray-modals">
					<li
						v-for="member in displayedMembers"
						class="flex items-center justify-between py-2 cursor-pointer"
					>
						<div
							@click="openProfile(member.username)"
							class="flex items-center gap-x-3 min-w-0 flex-1"
						>
							<Avatar
								:image="member.user_image"
								:label="member.full_name"
								size="xl"
								class="shrink-0"
							/>
							<div class="min-w-0 space-y-1">
								<div class="truncate text-ink-gray-9">
									{{ member.full_name }}
								</div>
								<div class="truncate text-sm text-ink-gray-7">
									{{ member.name }}
								</div>
							</div>
						</div>
						<div
							v-if="badgeRoles(member.roles).length"
							class="flex shrink-0 items-center gap-1 ms-3"
						>
							<span
								v-for="role in badgeRoles(member.roles)"
								:key="role"
								class="flex items-center text-ink-gray-9 gap-x-1 bg-surface-gray-2 px-2 py-1.5 rounded-md"
							>
								<Shield class="size-4 stroke-1.5" />
								<span class="text-sm">
									{{ getRole(role) }}
								</span>
							</span>
						</div>
						<div class="shrink-0 ms-2" @click.stop>
							<Dropdown
								:options="getMemberMenuOptions(member)"
								placement="right"
							>
								<Button variant="ghost" class="!px-1.5">
									<template #icon>
										<MoreHorizontal class="size-4 stroke-1.5 text-ink-gray-7" />
									</template>
								</Button>
							</Dropdown>
						</div>
					</li>
				</ul>
				<div
					v-if="memberList.length && hasNextPage"
					class="flex justify-center mt-4"
				>
					<Button @click="members.reload()">
						<template #prefix>
							<RefreshCw class="h-3 w-3 stroke-1.5" />
						</template>
						{{ __('Load More') }}
					</Button>
				</div>
			</div>
		</div>
	</SettingsLayout>
	<NewMemberModal
		v-model="showNewMember"
		:editMember="memberToEdit"
		@created="onMemberCreated"
		@updated="refreshMembers"
	/>

	<Dialog
		v-model="showDeleteDialog"
		:options="{
			title: memberToDelete
				? __('Delete {0}?').format(memberToDelete.full_name)
				: '',
			message: __(
				'This permanently deletes the user account and cannot be undone.'
			),
			size: 'sm',
			actions: [
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
			],
		}"
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
import { useRouter } from 'vue-router'
import { ref, computed, watch, inject } from 'vue'
import {
	MoreHorizontal,
	RefreshCw,
	Plus,
	Search,
	Shield,
} from 'lucide-vue-next'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import type { User } from '@/components/Settings/types'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
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

const displayedMembers = computed(() =>
	memberList.value.filter(
		(member) =>
			currentRole.value === 'All' || member.roles?.includes(currentRole.value)
	)
)
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

watch(search, () => {
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
