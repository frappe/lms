<template>
	<div class="text-base p-4">
		<div class="flex items-center justify-between">
			<div>
				<div class="font-semibold mb-1">
					{{ __(label) }}
				</div>
				<div class="text-xs text-gray-600">
					{{ __(description) }}
				</div>
			</div>
			<div class="flex item-center space-x-2">
				<FormControl
					v-model="search"
					:placeholder="__('Search')"
					type="text"
					:debounce="300"
				/>
				<Button @click="() => (showForm = true)">
					<template #icon>
						<Plus class="h-3 w-3 stroke-1.5" />
					</template>
				</Button>
			</div>
		</div>
		<div class="my-4">
			<!-- Form to add new member -->
			<div v-if="showForm" class="flex items-center space-x-2 mb-4">
				<FormControl
					v-model="member.email"
					:placeholder="__('Email')"
					type="email"
					class="w-full"
				/>
				<FormControl
					v-model="member.first_name"
					:placeholder="__('First Name')"
					type="test"
					class="w-full"
				/>
				<Button @click="addMember()" variant="subtle">
					{{ __('Add') }}
				</Button>
			</div>

			<!-- Member list -->
			<div
				v-for="member in memberList"
				class="grid grid-cols-5 grid-flow-row py-2 cursor-pointer"
			>
				<div
					@click="openProfile(member.username)"
					class="flex items-center space-x-2 col-span-2"
				>
					<Avatar
						:image="member.user_image"
						:label="member.full_name"
						size="sm"
					/>
					<div>
						{{ member.full_name }}
					</div>
				</div>
				<div class="text-sm text-gray-700 col-span-2">
					{{ member.name }}
				</div>
				<div class="text-sm text-gray-700 justify-self-end">
					{{ getRole(member.role) }}
				</div>
			</div>
		</div>
		<div v-if="hasNextPage" class="flex justify-center">
			<Button variant="solid" @click="members.reload()">
				<template #prefix>
					<RefreshCw class="h-3 w-3 stroke-1.5" />
				</template>
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import { createResource, Avatar, Button, FormControl } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ref, watch, reactive } from 'vue'
import { RefreshCw, Plus } from 'lucide-vue-next'

const router = useRouter()
const show = defineModel('show')
const search = ref('')
const start = ref(0)
const memberList = ref([])
const hasNextPage = ref(false)
const showForm = ref(false)

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
