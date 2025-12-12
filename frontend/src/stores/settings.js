import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'

export const useSettings = defineStore('settings', () => {
	const isSettingsOpen = ref(false)
	const isCommandPaletteOpen = ref(false)
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

	const programs = createResource({
		url: 'lms.lms.utils.get_programs',
		auto: false,
	})

	return {
		activeTab,
		isSettingsOpen,
		isCommandPaletteOpen,
		programs,
		settings,
		sidebarSettings,
	}
})
