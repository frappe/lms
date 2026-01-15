<template>
	<header class="flex h-14 w-full items-center justify-between border-b bg-surface-white px-5">
		<div class="flex items-center"></div>
		<div class="flex items-center gap-4">
			<Button variant="ghost" class="relative text-ink-gray-7 !bg-gray-50 !w-10 !h-10 rounded-full"
				@click="router.push({ name: 'Notifications' })">
				<Bell class="h-5 w-5 stroke-1.5" />
				<span v-if="unreadCount > 0"
					class="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
			</Button>

			<Dropdown :options="userDropdownOptions">
				<template v-slot="{ open }">
					<!-- redirect to my profile -->
					<button
						class="flex items-center gap-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500"
						v-if="profile.data || userResource.data"
						v-on:click="router.push(`/user/${userResource.data?.username}`)">
						<UserAvatar :user="profile.data || userResource.data" size='3xl' />
					</button>
				</template>
			</Dropdown>
		</div>
	</header>
	<SettingsModal v-if="userResource.data?.is_moderator" v-model="showSettingsModal" />
</template>

<script setup>
import {
	computed,
	ref,
	onMounted,
	onUnmounted,
	markRaw,
	watch,
	inject,
} from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import { useSettings } from '@/stores/settings'
import { createResource, Button, Dropdown } from 'frappe-ui'
import { createDialog } from '@/utils/dialogs'
import UserAvatar from '@/components/UserAvatar.vue'
import SettingsModal from '@/components/Settings/Settings.vue'
import Apps from '@/components/Sidebar/Apps.vue'
import Configuration from '@/components/Sidebar/Configuration.vue'
import FrappeCloudIcon from '@/components/Icons/FrappeCloudIcon.vue'

import {
	Bell,
	User,
	Moon,
	Sun,
	Settings,
	Wrench,
	LogOut,
	LogIn,
} from 'lucide-vue-next'

const router = useRouter()
const { user, isLoggedIn, logout } = sessionStore()
const { userResource } = usersStore()
const profile = createResource({
	url: 'lms.lms.api.get_profile_details',
	makeParams() {
		return {
			username: userResource.data?.username,
		}
	},
})
const settingsStore = useSettings()
const socket = inject('$socket')

const unreadCount = ref(0)

const showSettingsModal = ref(false)
const theme = ref('light')
const $dialog = createDialog
const frappeCloudBaseEndpoint = 'https://frappecloud.com'

onMounted(() => {
	theme.value = localStorage.getItem('theme') || 'light'
	if (['light', 'dark'].includes(theme.value)) {
		document.documentElement.setAttribute('data-theme', theme.value)
	}

	if (isLoggedIn) {
		unreadNotifications.reload()
	}

	watch(
		() => userResource.data?.username,
		(username) => {
			if (username) {
				profile.reload()
			}
		},
		{ immediate: true },
	)

	socket.on('publish_lms_notifications', (data) => {
		unreadNotifications.reload()
	})
})

onUnmounted(() => {
	socket.off('publish_lms_notifications')
})

const unreadNotifications = createResource({
	cache: 'Unread Notifications Count',
	url: 'frappe.client.get_count',
	makeParams(values) {
		return {
			doctype: 'Notification Log',
			filters: {
				for_user: user,
				read: 0,
			},
		}
	},
	onSuccess(data) {
		unreadCount.value = data
	},
	auto: false, // Triggered manually in onMounted
})

const toggleTheme = () => {
	const currentTheme = document.documentElement.getAttribute('data-theme')
	theme.value = currentTheme === 'dark' ? 'light' : 'dark'
	document.documentElement.setAttribute('data-theme', theme.value)
	localStorage.setItem('theme', theme.value)
}

const loginToFrappeCloud = () => {
	let redirect_to = '/dashboard/sites/' + userResource.data.sitename
	window.open(`${frappeCloudBaseEndpoint}${redirect_to}`, '_blank')
}

watch(
	() => settingsStore.isSettingsOpen,
	(value) => {
		showSettingsModal.value = value
	},
)

const userDropdownOptions = computed(() => {
	return [
		{
			group: '',
			items: [
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
					icon: theme.value === 'light' ? Moon : Sun,
					label: 'Toggle Theme',
					onClick: () => {
						toggleTheme()
					},
				},
				{
					component: markRaw(Apps),
					condition: () => {
						let cookies = new URLSearchParams(
							document.cookie.split('; ').join('&'),
						)
						let system_user = cookies.get('system_user')
						if (system_user === 'yes') return true
						else return false
					},
				},
				{
					icon: Settings,
					label: 'Settings',
					onClick: () => {
						settingsStore.isSettingsOpen = true
					},
					condition: () => {
						return userResource.data?.is_moderator
					},
				},
				{
					label: 'Configuration',
					icon: Wrench,
					submenu: [
						{
							component: markRaw(Configuration),
						},
					],
					condition: () => {
						return userResource.data?.is_moderator
					},
				},
				{
					icon: FrappeCloudIcon,
					label: 'Login to Frappe Cloud',
					onClick: () => {
						$dialog({
							title: __('Login to Frappe Cloud?'),
							message: __(
								'Are you sure you want to login to your Frappe Cloud dashboard?',
							),
							actions: [
								{
									label: __('Confirm'),
									variant: 'solid',
									onClick(close) {
										loginToFrappeCloud()
										close()
									},
								},
							],
						})
					},
					condition: () => {
						return (
							userResource.data?.is_system_manager &&
							userResource.data?.is_fc_site
						)
					},
				},
				{
					icon: LogOut,
					label: 'Log out',
					onClick: () => {
						logout.submit()
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
			],
		},
	]
})
</script>
