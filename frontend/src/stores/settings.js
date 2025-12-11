import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'
import { sessionStore } from './session'

export const useSettings = defineStore('settings', () => {
	const isSettingsOpen = ref(false)
	const activeTab = ref(null)

	const settings = createResource({
		url: 'lms.lms.api.get_lms_settings',
		auto: true,
		cache: 'LMS Settings',
	})

	const sidebarSettings = createResource({
		url: 'lms.lms.api.get_sidebar_settings',
		cache: 'Sidebar Settings',
		auto: false,
	})

	return {
		isSettingsOpen,
		activeTab,
		settings,
		sidebarSettings,
	}
})
