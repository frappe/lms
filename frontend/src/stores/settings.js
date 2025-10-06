import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'
import { sessionStore } from './session'

export const useSettings = defineStore('settings', () => {
	const isSettingsOpen = ref(false)
	const activeTab = ref(null)

	const allowGuestAccess = createResource({
		url: 'lms.lms.api.get_lms_setting',
		params: { field: 'allow_guest_access' },
		auto: true,
		cache: ['allowGuestAccess'],
	})

	const preventSkippingVideos = createResource({
		url: 'lms.lms.api.get_lms_setting',
		params: { field: 'prevent_skipping_videos' },
		auto: true,
		cache: ['preventSkippingVideos'],
	})

	const contactUsEmail = createResource({
		url: 'lms.lms.api.get_lms_setting',
		params: { field: 'contact_us_email' },
		auto: true,
		cache: ['contactUsEmail'],
	})

	const contactUsURL = createResource({
		url: 'lms.lms.api.get_lms_setting',
		params: { field: 'contact_us_url' },
		auto: true,
		cache: ['contactUsURL'],
	})

	const sidebarSettings = createResource({
		url: 'lms.lms.api.get_sidebar_settings',
		cache: 'Sidebar Settings',
		auto: false,
	})

	return {
		isSettingsOpen,
		activeTab,
		allowGuestAccess,
		preventSkippingVideos,
		contactUsEmail,
		contactUsURL,
		sidebarSettings,
	}
})
