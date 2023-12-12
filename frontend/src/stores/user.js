import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { reactive } from 'vue'

export const usersStore = defineStore('lms-users', () => {
	let usersByName = reactive({})

	const user = createResource({
		url: 'lms.lms.api.get_user_info',
		cache: 'Users',
		initialData: [],
		auto: true,
		transform: (data) => {
			if (data?.name && !usersByName[data.name]) {
				usersByName[data.name] = data
			}
		},
		onError(error) {
			if (error && error.exc_type === 'AuthenticationError') {
				router.push('/login')
			}
		},
	})

	return {
		user,
		usersByName,
	}
})
