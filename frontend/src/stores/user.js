import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'

export const usersStore = defineStore('lms-users', () => {
	let userResource = createResource({
		url: 'lms.lms.api.get_user_info',
		onError(error) {
			if (error && error.exc_type === 'AuthenticationError') {
				router.push('/login')
			}
		},
	})

	const allUsers = createResource({
		url: 'lms.lms.api.get_all_users',
		cache: ['allUsers'],
		/* transform(data) {
			return data.map((user) => {
				return {
					value: user.name,
					label: user.full_name.trimEnd(),
				}
			})
		}, */
	})

	return {
		userResource,
		allUsers,
	}
})
