<template>
	<div class="flex items-center gap-4">
		<Dropdown
			:options="userDropdownOptions"
			placement="right"
			side="bottom"
			class="border"
			offset="1"
		>
			<template v-slot="{ open }">
				<button
					class="flex items-center gap-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500"
				>
					<UserAvatar :user="profile.data || userResource.data" size="2xl" />
				</button>
			</template>
		</Dropdown>
		<SettingsModal
			v-if="userResource.data?.is_moderator"
			v-model="showSettingsModal"
		/>
	</div>
</template>

<script setup>
import { computed, ref, onMounted, markRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import { useSettings } from '@/stores/settings'
import { createResource, Dropdown } from 'frappe-ui'
import { createDialog } from '@/utils/dialogs'
import UserAvatar from '@/components/UserAvatar.vue'
import SettingsModal from '@/components/Settings/Settings.vue'
import Apps from '@/components/Sidebar/Apps.vue'
import Configuration from '@/components/Sidebar/Configuration.vue'
import FrappeCloudIcon from '@/components/Icons/FrappeCloudIcon.vue'
import CircleProfileIcon from '@/components/Icons/CircleProfileIcon.vue'
import LogoutIcon from '@/components/Icons/LogoutIcon.vue'

import { Moon, Sun, Settings, Wrench, LogOut, LogIn } from 'lucide-vue-next'
import { h } from 'vue'

const router = useRouter()
const { isLoggedIn, logout } = sessionStore()
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

const showSettingsModal = ref(false)
const theme = ref('light')
const $dialog = createDialog
const frappeCloudBaseEndpoint = 'https://frappecloud.com'

onMounted(() => {
	theme.value = localStorage.getItem('theme') || 'light'
	if (['light', 'dark'].includes(theme.value)) {
		document.documentElement.setAttribute('data-theme', theme.value)
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
	const items = [
		{
			icon: CircleProfileIcon,
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
				let cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
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
					userResource.data?.is_system_manager && userResource.data?.is_fc_site
				)
			},
		},
		{
			label: 'Log out',
			icon: LogOut,
			onClick: () => {
				logout.submit()
			},
			condition: () => {
				return isLoggedIn
			},
			component: markRaw({
				render() {
					return h(
						'button',
						{
							class:
								'flex items-center w-full px-2 py-1.5 text-red-500 hover:bg-red-50 rounded transition-colors text-left min-w-60',
							onClick: () => logout.submit(),
						},
						[
							h(LogoutIcon, { class: 'size-4 mr-2 stroke-[1.5px]' }),
							h('span', { class: 'text-sm font-medium' }, __('Log out')),
						],
					)
				},
			}),
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

	return [
		{
			group: 'Navigation',
			items: items.filter(
				(i) =>
					!['My Profile', 'Log out', 'Log in'].includes(i.label) &&
					(!i.condition || i.condition()),
			),
		},
		{
			group: 'Profile',
			items: items.filter(
				(i) =>
					['My Profile', 'Log out', 'Log in'].includes(i.label) &&
					(!i.condition || i.condition()),
			),
		},
	]
})
</script>
