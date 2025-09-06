import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'

export const usersStore = defineStore('lms-users', () => {
	let userResource = createResource({
		url: 'lms.lms.api.get_user_info',
		onError(error) {
			if (error && error.exc_type === 'AuthenticationError') {
				window.location.href = '/login'
			}
		},
		auto: true,
	})

	const allUsers = createResource({
		url: 'lms.lms.api.get_all_users',
		cache: ['allUsers'],
	})

	return {
		userResource,
		allUsers,
	}
})
