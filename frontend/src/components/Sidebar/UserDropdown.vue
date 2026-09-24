<template>
	<SidebarHeader
		:title="appName"
		:subtitle="
			userResource.data ? convertToTitleCase(userResource.data.full_name) : ''
		"
		:menuItems="userDropdownOptions"
	>
		<template #prefix>
			<img
				v-if="branding.data?.banner_image"
				:src="safeUrl(branding.data?.banner_image.file_url)"
				alt=""
				class="size-full object-cover"
			/>
			<LMSLogo v-else class="size-full" />
		</template>
	</SidebarHeader>
	<SettingsModal v-if="userResource.data?.is_moderator" />
</template>

<script setup>
import { sessionStore } from '@/stores/session'
import { call, createResource, SidebarHeader, toast } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { convertToTitleCase } from '@/utils'
import { setThemePreference, themePreference } from '@/utils/theme'
import { usersStore } from '@/stores/user'
import { useSettings } from '@/stores/settings'
import { h, computed } from 'vue'
import { createDialog } from '@/utils/dialogs'
import FrappeCloudIcon from '@/components/Icons/FrappeCloudIcon.vue'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import SettingsModal from '@/components/Settings/Settings.vue'
import { safeUrl } from '@/utils/safeUrl'
import { openExternal } from '@/utils/openExternal'
import { pushSettingsHash } from '@/composables/useSettingsHash'

const router = useRouter()
const { logout, branding } = sessionStore()
let { userResource } = usersStore()
const settingsStore = useSettings()
let { isLoggedIn } = sessionStore()
const frappeCloudBaseEndpoint = 'https://frappecloud.com'
const $dialog = createDialog

const appName = computed(() =>
	branding.data?.app_name && branding.data.app_name != 'Frappe'
		? branding.data.app_name
		: 'Learning'
)

// SidebarHeader passes no slots through to its Dropdown, so the check that
// marks the current theme rides on each option instead.
const themeCheck = {
	suffix: ({ selected }) =>
		selected
			? h('span', {
					class: 'lucide-check size-4 text-ink-gray-7',
					'aria-hidden': 'true',
			  })
			: null,
}

const apps = createResource({
	url: 'frappe.apps.get_apps',
	cache: 'apps',
	auto: true,
	transform: (data) => [deskApp(), ...siblingApps(data)],
})

function deskApp() {
	return {
		name: 'frappe',
		logo: '/assets/lms/images/desk.png',
		title: __('Desk'),
		route: '/desk/learning',
	}
}

function siblingApps(data) {
	return data
		.filter((app) => app.name !== 'lms')
		.map((app) => ({
			name: app.name,
			logo: app.logo,
			title: __(app.title),
			route: app.route,
		}))
}

const appMenuItems = computed(() => {
	return (apps.data || []).map((app) => ({
		label: app.title,
		onClick: () => {
			window.location.href = app.route
		},
		slots: {
			prefix: () =>
				// alt="" deliberately: the row's own label names the app, and a
				// second announcement of it would only repeat. Without it a screen
				// reader falls back to reading the logo's filename.
				h('img', {
					class: 'size-4 shrink-0 rounded-4',
					src: app.logo,
					alt: '',
				}),
		},
	}))
})

const userDropdownOptions = computed(() => {
	return [
		{
			group: '',
			options: [
				{
					icon: 'lucide-user',
					label: 'My Profile',
					onClick: () => {
						router.push(`/user/${userResource.data?.username}`)
					},
					condition: () => {
						return isLoggedIn
					},
				},
				{
					icon: 'lucide-sun-moon',
					label: __('Theme'),
					submenu: [
						{
							icon: 'lucide-sun',
							label: __('Light'),
							selected: themePreference.value === 'light',
							slots: themeCheck,
							onClick: () => setThemePreference('light'),
						},
						{
							icon: 'lucide-moon',
							label: __('Dark'),
							selected: themePreference.value === 'dark',
							slots: themeCheck,
							onClick: () => setThemePreference('dark'),
						},
						{
							icon: 'lucide-monitor',
							label: __('System'),
							selected: themePreference.value === 'system',
							slots: themeCheck,
							onClick: () => setThemePreference('system'),
						},
					],
				},
				{
					icon: 'lucide-layout-grid',
					label: __('Apps'),
					submenu: appMenuItems.value,
					condition: () => {
						let cookies = new URLSearchParams(
							document.cookie.split('; ').join('&')
						)
						let system_user = cookies.get('system_user')
						if (system_user === 'yes') return true
						else return false
					},
				},
				{
					icon: 'lucide-settings',
					label: 'Settings',
					onClick: () => {
						pushSettingsHash(router)
					},
					condition: () => {
						return userResource.data?.is_moderator
					},
				},
				{
					icon: 'lucide-wrench',
					label: __('Configuration'),
					submenu: [
						{
							icon: 'lucide-arrow-down-to-line',
							label: __('Import'),
							onClick: () => {
								router.push({
									name: 'DataImportList',
									query: { step: 'list' },
								})
							},
						},
					],
					condition: () => {
						return userResource.data?.is_moderator
					},
				},
				{
					label: 'Clear Demo Data',
					icon: 'lucide-trash-2',
					onClick: () => {
						clearDemoDataConfirmation()
					},
					condition: () => {
						return (
							userResource.data?.is_moderator &&
							settingsStore.settings.data?.demo_data_present
						)
					},
				},
				{
					icon: FrappeCloudIcon,
					label: 'Login to Frappe Cloud',
					onClick: () => {
						$dialog({
							title: __('Login to Frappe Cloud?'),
							message: __(
								'Are you sure you want to login to your Frappe Cloud dashboard?'
							),
							actions: [
								{
									label: __('Confirm'),
									variant: 'solid',
									onClick({ close }) {
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
					icon: 'lucide-log-out',
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
					icon: 'lucide-log-in',
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

const loginToFrappeCloud = () => {
	let redirect_to = '/dashboard/sites/' + userResource.data.sitename
	openExternal(`${frappeCloudBaseEndpoint}${redirect_to}`)
}

const clearDemoDataConfirmation = () => {
	$dialog({
		title: __('Confirm clearing demo data?'),
		message: __(
			'Are you sure you want to clear the demo data? This would delete the course "A guide  to Frappe Learning" along with all its associated data. This action cannot be undone.'
		),
		actions: [
			{
				label: __('Confirm'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }) {
					clearDemoData()
					close()
				},
			},
		],
	})
}

const clearDemoData = () => {
	call('lms.lms.api.clear_demo_data')
		.then(() => {
			window.location.href = '/lms'
			toast.success(__('Demo data cleared successfully'))
		})
		.catch((error) => {
			toast.error(__(error.message || 'Error clearing demo data'))
			console.error('Error clearing demo data:', error)
		})
}
</script>
