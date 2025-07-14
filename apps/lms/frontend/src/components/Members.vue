<template>
	<div class="flex min-h-0 flex-col text-base">
		<div class="flex items-center justify-between">
			<div>
				<div class="text-xl font-semibold mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<!-- <div class="text-xs text-ink-gray-5">
					{{ __(description) }}
				</div> -->
			</div>
			<div class="flex item-center space-x-2">
				<FormControl
					v-model="search"
					:placeholder="__('Search')"
					type="text"
					:debounce="300"
				/>
				<Button @click="() => (showForm = !showForm)">
					<template #prefix>
						<Plus v-if="!showForm" class="size-4 stroke-1.5" />
						<X v-else class="size-4 stroke-1.5" />
					</template>
					{{ showForm ? __('Close') : __('New') }}
				</Button>
			</div>
		</div>

		<!-- Form to add new member -->
		<div v-if="showForm" class="flex items-center space-x-2 my-4">
			<FormControl
				v-model="member.email"
				:placeholder="__('Email')"
				type="email"
				class="w-full"
			/>
			<FormControl
				v-model="member.first_name"
				:placeholder="__('First Name')"
				type="text"
				class="w-full"
			/>
			<Button @click="addMember()" variant="subtle">
				{{ __('Add') }}
			</Button>
		</div>

		<div class="mt-2 pb-10 overflow-auto">
			<!-- Member list -->
			<div class="overflow-y-scroll">
				<ul class="divide-y">
					<li
						v-for="member in memberList"
						class="grid grid-cols-3 gap-10 py-2 cursor-pointer"
					>
						<div
							@click="openProfile(member.username)"
							class="flex items-center space-x-3 col-span-2"
						>
							<Avatar
								:image="member.user_image"
								:label="member.full_name"
								size="lg"
							/>
							<div class="space-y-1">
								<div class="flex">
									<div class="text-ink-gray-9">
										{{ member.full_name }}
									</div>
									<div
										class="px-1"
										v-if="member.role && getRole(member.role) !== 'Student'"
									>
										<Badge
											:variant="'subtle'"
											:ref_for="true"
											theme="blue"
											size="sm"
											label="Badge"
										>
											{{ getRole(member.role) }}
										</Badge>
									</div>
								</div>
								<div class="text-sm text-ink-gray-7">
									{{ member.name }}
								</div>
							</div>
						</div>
						<div
							class="flex items-center justify-center text-ink-gray-7 text-sm"
						>
							<div v-if="member.last_active">
								{{ dayjs(member.last_active).format('DD MMM, YYYY HH:mm a') }}
							</div>
							<div v-else>-</div>
						</div>
					</li>
				</ul>
			</div>
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
</template>
<script setup lang="ts">
import { createResource, Avatar, Button, FormControl, Badge } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ref, watch, reactive, inject } from 'vue'
import { RefreshCw, Plus, X } from 'lucide-vue-next'
import { useOnboarding } from 'frappe-ui/frappe'

interface User {
	data: {
		email: string
		name: string
		enabled: boolean
		user_image: string
		full_name: string
		user_type: ['System User', 'Website User']
		username: string
		is_moderator: boolean
		is_system_manager: boolean
		is_evaluator: boolean
		is_instructor: boolean
		is_fc_site: boolean
	}
}

const router = useRouter()
const show = defineModel('show')
const search = ref('')
const start = ref(0)
const memberList = ref([])
const hasNextPage = ref(false)
const showForm = ref(false)
const dayjs = inject('$dayjs')
const user = inject<User | null>('$user')
const { updateOnboardingStep } = useOnboarding('learning')

const member = reactive({
	email: '',
	first_name: '',
})

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		default: '',
	},
	show: {
		type: Boolean,
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
	onSuccess(data) {
		memberList.value = memberList.value.concat(data)
		start.value = start.value + 20
		hasNextPage.value = data.length === 20
	},
	auto: true,
})

const openProfile = (username) => {
	show.value = false
	router.push({
		name: 'Profile',
		params: {
			username: username,
		},
	})
}

const newMember = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'User',
				first_name: member.first_name,
				email: member.email,
			},
		}
	},
	auto: false,
	onSuccess(data) {
		show.value = false

		if (user?.data?.is_system_manager) updateOnboardingStep('invite_students')

		router.push({
			name: 'Profile',
			params: {
				username: data.username,
			},
		})
	},
})

const addMember = () => {
	newMember.reload()
}

watch(search, () => {
	memberList.value = []
	start.value = 0
	members.reload()
})

const getRole = (role) => {
	const map = {
		'LMS Student': 'Student',
		'Course Creator': 'Instructor',
		Moderator: 'Moderator',
		'Batch Evaluator': 'Evaluator',
	}
	return map[role]
}
</script>
