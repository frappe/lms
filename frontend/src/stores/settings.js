import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'

export const useSettings = defineStore('settings', () => {
	const isSettingsOpen = ref(false)
	const isCommandPaletteOpen = ref(false)
	const activeTab = ref(null)
	// The field a caller opened settings for. The tab it lives on takes it,
	// clears it, and has SettingsFields scroll to it and flash it.
	const focusField = ref(null)

	// Settings is the desktop dialog and has no route of its own, so it is
	// mounted only inside the desktop sidebar's UserDropdown. On a phone nothing
	// is listening to isSettingsOpen at all, and callers need to know that rather
	// than flip a flag into the void. Settings.vue owns this.
	const isSettingsMounted = ref(false)

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

	// The cached copy is shown at once, but fetched again once per page load:
	// otherwise a browser that cached it keeps showing links an admin has since
	// hidden, for good, since nothing else ever reloads it.
	let revalidated = false

	function loadSidebarSettings(force = false) {
		if (sidebarSettings.loading) return sidebarSettings.promise
		if (force || !sidebarSettings.data) {
			revalidated = true
			return sidebarSettings.reload()
		}
		if (!revalidated) {
			revalidated = true
			sidebarSettings.reload()
		}
		return Promise.resolve(sidebarSettings.data)
	}

	const programs = createResource({
		url: 'lms.lms.utils.get_programs',
		auto: false,
	})

	return {
		activeTab,
		focusField,
		isSettingsOpen,
		isSettingsMounted,
		isCommandPaletteOpen,
		programs,
		settings,
		sidebarSettings,
		loadSidebarSettings,
	}
})
