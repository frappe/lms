import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createResource } from 'frappe-ui'

export const useSettings = defineStore('settings', () => {
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
		auto: true,
		cache: ['learningPaths'],
	})

	const onboardingDetails = createResource({
		url: 'lms.lms.utils.is_onboarding_complete',
		auto: true,
		cache: ['onboardingDetails'],
	})

	return {
		isSettingsOpen,
		activeTab,
		learningPaths,
		onboardingDetails,
	}
})
