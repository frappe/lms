import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'
import { sessionStore } from './session'

export const useSettings = defineStore('settings', () => {
	const { isLoggedIn } = sessionStore()
	const isSettingsOpen = ref(false)
	const activeTab = ref(null)

	const learningPaths = createResource({
		url: 'lms.lms.api.get_lms_setting',
		params: { field: 'enable_learning_paths' },
		auto: true,
		cache: ['learningPath'],
	})

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

	const sidebarSettings = createResource({
		url: 'lms.lms.api.get_sidebar_settings',
		cache: 'Sidebar Settings',
		auto: false,
	})

	return {
		isSettingsOpen,
		activeTab,
		learningPaths,
		allowGuestAccess,
		preventSkippingVideos,
		sidebarSettings,
	}
})
