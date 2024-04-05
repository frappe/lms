import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { usersStore } from './user'
import router from '@/router'
import { ref, computed } from 'vue'

export const sessionStore = defineStore('lms-session', () => {
	let { userResource } = usersStore()

	function sessionUser() {
		let cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
		let _sessionUser = cookies.get('user_id')
		if (_sessionUser === 'Guest') {
			_sessionUser = null
		}
		return _sessionUser
	}

	let user = ref(sessionUser())
	const isLoggedIn = computed(() => !!user.value)

	const login = createResource({
		url: 'login',
		onError() {
			throw new Error('Invalid email or password')
		},
		onSuccess() {
			userResource.reload()
			user.value = sessionUser()
			login.reset()
			router.replace({ path: '/' })
		},
	})

	const logout = createResource({
		url: 'logout',
		onSuccess() {
			userResource.reset()
			user.value = null
			window.location.reload()
		},
	})

	return {
		user,
		isLoggedIn,
		login,
		logout,
	}
})
