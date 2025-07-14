import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'
import { sessionStore } from './session'

export const useSettings = defineStore('settings', () => {
	const { isLoggedIn } = sessionStore()
	const isSettingsOpen = ref(false)
	const activeTab = ref(null)

	const learningPaths = createResource({
		url: 'lms.lms.api.is_learning_path_enabled',
		auto: true,
		cache: ['learningPath'],
	})

	const allowGuestAccess = createResource({
		url: 'lms.lms.api.is_guest_allowed',
		auto: true,
		cache: ['allowGuestAccess'],
	})

	return {
		isSettingsOpen,
		activeTab,
		learningPaths,
		allowGuestAccess,
	}
})
