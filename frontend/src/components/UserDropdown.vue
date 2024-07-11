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
				<span
					v-if="branding.data?.brand_html"
					v-html="branding.data?.brand_html"
					class="w-8 h-8 rounded flex-shrink-0"
				></span>
				<LMSLogo v-else class="w-8 h-8 rounded flex-shrink-0" />
				<div
					class="flex flex-1 flex-col text-left duration-300 ease-in-out"
					:class="
						isCollapsed
							? 'opacity-0 ml-0 w-0 overflow-hidden'
							: 'opacity-100 ml-2 w-auto'
					"
				>
					<div class="text-base font-medium text-gray-900 leading-none">
						<span
							v-if="
								branding.data?.brand_name &&
								branding.data?.brand_name != 'Frappe'
							"
						>
							{{ branding.data?.brand_name }}
						</span>
						<span v-else> Learning </span>
					</div>
					<div
						v-if="userResource"
						class="mt-1 text-sm text-gray-700 leading-none"
					>
						{{ convertToTitleCase(userResource.data?.full_name) }}
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
import {
	ChevronDown,
	LogIn,
	LogOut,
	User,
	ArrowRightLeft,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { convertToTitleCase } from '../utils'
import { usersStore } from '@/stores/user'

const router = useRouter()
const { logout, branding } = sessionStore()
let { userResource } = usersStore()
let { isLoggedIn } = sessionStore()

const props = defineProps({
	isCollapsed: {
		type: Boolean,
		default: false,
	},
})

const userDropdownOptions = [
	{
		icon: User,
		label: 'My Profile',
		onClick: () => {
			router.push(`/user/${userResource.data?.username}`)
		},
		condition: () => {
			return isLoggedIn
		},
	},
	{
		icon: ArrowRightLeft,
		label: 'Switch to Desk',
		onClick: () => {
			window.location.href = '/app'
		},
		condition: () => {
			let cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
			let system_user = cookies.get('system_user')
			if (system_user === 'yes') return true
			else return false
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
