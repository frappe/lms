import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { usersStore } from './user'
import router from '@/router'
import { ref, computed } from 'vue'

export const sessionStore = defineStore('lms-session', () => {
	const { user, usersByName } = usersStore()

	function currentUser() {
		let cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
		let _sessionUser = cookies.get('user_id')
		if (_sessionUser === 'Guest') {
			_sessionUser = null
		}
		return _sessionUser
	}

	let sessionUser = ref(currentUser())
	const isLoggedIn = ref(!!sessionUser.value)

	function getUser() {
		if (!sessionUser.value) {
			return null
		}
		if (usersByName[sessionUser.value]) {
			return usersByName[sessionUser.value]
		}
		return user.value
	}

	const login = createResource({
		url: 'login',
		onError() {
			throw new Error('Invalid email or password')
		},
		onSuccess() {
			user.reload()
			sessionUser.value = currentUser()
			login.reset()
			router.replace({ path: '/' })
		},
	})

	const logout = createResource({
		url: 'logout',
		onSuccess() {
			user.reset()
			sessionUser.value = null
		},
	})

	return {
		sessionUser,
		isLoggedIn,
		login,
		logout,
		getUser,
	}
})
