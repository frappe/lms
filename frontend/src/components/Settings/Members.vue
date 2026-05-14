<template>
	<div class="flex min-h-0 flex-col text-base">
		<div class="flex items-center justify-between">
			<div>
				<div class="text-xl font-semibold mb-2 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<div class="text-ink-gray-6 leading-5">
					{{ __(description) }}
				</div>
			</div>
			<div class="flex item-center gap-x-2">
				<Button @click="showNewMember = true">
					<template #prefix>
						<Plus class="size-4 stroke-1.5" />
					</template>
					{{ __('New') }}
				</Button>
			</div>
		</div>

		<div class="mt-8 pb-10">
			<FormControl
				v-model="search"
				:placeholder="__('Search')"
				type="text"
				:debounce="300"
				class="w-1/4 mb-4"
			>
				<template #prefix>
					<Search class="size-4 stroke-1.5 text-ink-gray-5" />
				</template>
			</FormControl>
			<div class="overflow-y-auto max-h-[60vh]">
				<ul class="divide-y divide-outline-gray-modals">
					<li
						v-for="member in memberList"
						class="flex items-center justify-between py-2 cursor-pointer"
					>
						<div
							@click="openProfile(member.username)"
							class="flex items-center gap-x-3 col-span-2"
						>
							<Avatar
								:image="member.user_image"
								:label="member.full_name"
								size="xl"
							/>
							<div class="space-y-1">
								<div class="flex">
									<div class="text-ink-gray-9">
										{{ member.full_name }}
									</div>
								</div>
								<div class="text-sm text-ink-gray-7">
									{{ member.name }}
								</div>
							</div>
						</div>
						<div
							class="flex items-center text-ink-gray-9 gap-x-1 bg-surface-gray-2 px-2 py-1.5 rounded-md"
							v-if="member.role && member.role !== 'LMS Student'"
						>
							<Shield class="size-4 stroke-1.5" />
							<span class="text-sm">
								{{ getRole(member.role) }}
							</span>
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
	</div>
	<NewMemberModal v-model="showNewMember" @created="onMemberCreated" />
</template>
<script setup lang="ts">
import { Avatar, Button, createResource, FormControl } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ref, watch, inject } from 'vue'
import { RefreshCw, Plus, Search, Shield } from 'lucide-vue-next'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import type { User } from '@/components/Settings/types'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'

type Member = {
	username: string
	full_name: string
	name: string
	role?: string
	user_image?: string
}

const router = useRouter()
const show = defineModel('show')
const search = ref('')
const start = ref(0)
const memberList = ref<Member[]>([])
const hasNextPage = ref(false)
const showNewMember = ref(false)
const user = inject<User | null>('$user')
const { updateOnboardingStep } = useOnboarding('learning')
const { capture } = useTelemetry()

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
	memberList.value = []
	start.value = 0
	members.reload()
}

watch(search, () => {
	memberList.value = []
	start.value = 0
	members.reload()
})

const getRole = (role: string) => {
	const map: Record<string, string> = {
		'LMS Student': 'Student',
		'Course Creator': 'Instructor',
		Moderator: 'Moderator',
		'Batch Evaluator': 'Evaluator',
	}
	return map[role]
}
</script>
