<template>
	<Dropdown :options="userDropdownOptions">
		<template v-slot="{ open }">
			<button
				class="flex h-12 py-2 items-center rounded-md duration-300 ease-in-out"
				:class="
					isCollapsed
						? 'px-0 w-auto'
						: open
						? 'bg-white shadow-sm px-2 w-52'
						: 'hover:bg-gray-200 px-2 w-52'
				"
			>
				<LMSLogo class="w-8 h-8 rounded flex-shrink-0" />
				<div
					class="flex flex-1 flex-col text-left duration-300 ease-in-out"
					:class="
						isCollapsed
							? 'opacity-0 ml-0 w-0 overflow-hidden'
							: 'opacity-100 ml-2 w-auto'
					"
				>
					<div class="text-base font-medium text-gray-900 leading-none">
						Learning
					</div>
					<div v-if="user" class="mt-1 text-sm text-gray-700 leading-none">
						{{ convertToTitleCase(user.split('@')[0]) }}
					</div>
				</div>
				<div
					class="duration-300 ease-in-out"
					:class="
						isCollapsed
							? 'opacity-0 ml-0 w-0 overflow-hidden'
							: 'opacity-100 ml-2 w-auto'
					"
				>
					<ChevronDown class="h-4 w-4 text-gray-700" />
				</div>
			</button>
		</template>
	</Dropdown>
</template>

<script setup>
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import { sessionStore } from '@/stores/session'
import { Dropdown } from 'frappe-ui'
import { ChevronDown, LogIn, LogOut, User } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { convertToTitleCase } from '../utils'

const router = useRouter()
const props = defineProps({
	isCollapsed: {
		type: Boolean,
		default: false,
	},
})

const { logout, user } = sessionStore()
let { isLoggedIn } = sessionStore()
const userDropdownOptions = [
	{
		icon: User,
		label: 'My Profile',
		onClick: () => {
			router.push(`/user/${user.data?.username}`)
		},
		condition: () => {
			return isLoggedIn
		},
	},
	{
		icon: LogOut,
		label: 'Log out',
		onClick: () => {
			logout.submit().then(() => {
				isLoggedIn = false
			})
		},
		condition: () => {
			return isLoggedIn
		},
	},
	{
		icon: LogIn,
		label: 'Log in',
		onClick: () => {
			window.location.href = '/login'
		},
		condition: () => {
			return !isLoggedIn
		},
	},
]
</script>
