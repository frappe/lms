<template>
	<header class="flex h-16 w-full items-center justify-between border-b bg-surface-white px-5">
		<div class="flex items-center"></div>
		<div class="flex items-center gap-4" v-if="profile.data || userResource.data">
			 <Popover placement="bottom-end">
				<template #target="{ togglePopover }">
				<Button @click="togglePopover()" variant="ghost" class="relative text-ink-gray-7 !bg-gray-50 !w-10 !h-10 rounded-full">
					<Bell class="h-5 w-5 stroke-1.5" />
					<span v-if="unreadCount > 0"
						class="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
				</Button>
				</template>
				<template #body-main :class="'p-0'">
					<div class="w-96 h-80 bg-white rounded flex flex-col">
						<div class="flex items-center justify-between border-b p-4">
							<h2 class="text-lg font-semibold">Notifications</h2>
							<Button variant="ghost" class="text-secondary-500 bg-transparent"
							@click="markAllAsRead.submit" :loading="markAllAsRead.loading">Mark all as read</Button>
						</div>
						<div class="flex-1 p-4 overflow-y-auto">
							<div v-if="notifications?.data?.length" v-for="log in notifications?.data" :key="log.name"
							class="flex items-center py-2 justify-between">
								<div class="flex items-start bg-[#F2FFFC] p-4 rounded-xl border border-gray-100 w-full space-x-4 cursor-pointer"
								@click="(e) => handleMarkAsRead(e, log.name)"
								:class="!log.read ? 'bg-[#F2FFFC]' : 'bg-white'"
								>
									<!-- <Avatar :image="log.user_image" :label="log.full_name" class="mr-2" /> -->
									<div v-if="log.document_type === 'LMS Quiz Submission'">
										<img src="/icons/score.png" alt="score" class="w-10 h-10 flex-shrink-0" />
									</div>
									<div v-else>
										<img src="/icons/notif.png" alt="score" class="w-10 h-10 flex-shrink-0" />
									</div>
									<div class="notification flex-1">
										<div class="text-gray-900 text-md md:font-medium md:text-lg" v-html="log.subject"></div>
										<div class="text-gray-700 font-regular text-sm md:text-md">
											{{ dayjs(log?.creation).fromNow() }}
										</div>
									</div>
								</div>
							</div>
							<div v-else>
								<div class="m-auto flex flex-col items-center justify-center">
									<EmptyIcon />
									<h2 class="text-lg font-semibold text-gray-900 mt-4">Everything looks quiet for now</h2>
									<p class="text-gray-600">Your learning updates will show up here soon</p>
								</div>
							</div>
						</div>
						<div class="border-t flex justify-center items-center py-1.5 text-secondary-500 text-sm cursor-pointer font-medium"
						@click="router.push({ name: 'Notifications' })">
							View all notification
						</div>
					</div>
				</template>
			</Popover>

			<Dropdown :options="userDropdownOptions" placement="right" side="bottom">
				<template v-slot="{ open }">
					<button
						class="flex items-center gap-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500"
					>
						<UserAvatar :user="profile.data || userResource.data" size='2xl' />
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
import { createListResource,createResource, Button, Dropdown,Popover } from 'frappe-ui'
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
import dayjs from 'dayjs'

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
		if(unreadNotifications.data?.length > 0) {
			unreadNotifications.reload()
		}
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

const notifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {
		for_user: user.data?.name,
		read: 0,
	},
	auto: true,
	cache: 'Unread Notifications',
})

const readNotifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {
		for_user: user?.data?.name,
		read: 1,
	},
	auto: true,
	cache: 'Read Notifications',
})

const markAllAsRead = createResource({
	url: 'lms.lms.api.mark_all_as_read',
	onSuccess(data) {
		unreadNotifications.reload()
		readNotifications.reload()
	},
})


const markAsRead = createResource({
	url: 'lms.lms.api.mark_as_read',
	makeParams(values) {
		return {
			name: values.name,
		}
	},
	onSuccess(data) {
		unReadNotifications.reload()
		readNotifications.reload()
	},
})

const handleMarkAsRead = (e, logName) => {
	markAsRead.submit({ name: logName })
}


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
