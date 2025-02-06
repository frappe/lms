import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'
import { sessionStore } from './session'

export const useSettings = defineStore('settings', () => {
	const { isLoggedIn } = sessionStore()
	const isSettingsOpen = ref(false)
	const activeTab = ref(null)

	const learningPaths = createResource({
		url: 'frappe.client.get_single_value',
		makeParams(values) {
			return {
				doctype: 'LMS Settings',
				field: 'enable_learning_paths',
			}
		},
		auto: isLoggedIn ? true : false,
		cache: ['learningPaths'],
	})

	const allowGuestAccess = createResource({
		url: 'lms.lms.api.is_guest_allowed',
		auto: true,
		cache: ['allowGuestAccess'],
	})

	/* const onboardingDetails = createResource({
		url: 'lms.lms.utils.is_onboarding_complete',
		auto: isLoggedIn ? true : false,
		cache: ['onboardingDetails'],
	}) */

	return {
		isSettingsOpen,
		activeTab,
		learningPaths,
		allowGuestAccess,
	}
})
