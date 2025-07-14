import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { usersStore } from './user'
import router from '@/router'
import { computed, reactive, ref } from 'vue'

export const sessionStore = defineStore('lms-session', () => {
	let { userResource } = usersStore()
	const brand = reactive({})

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

	const branding = createResource({
		url: 'lms.lms.api.get_branding',
		cache: 'brand',
		auto: true,
		onSuccess(data) {
			brand.name = data.app_name
			brand.logo = data.app_logo
			brand.favicon =
				data.favicon?.file_url || '/assets/lms/frontend/learning.svg'
		},
	})

	const sidebarSettings = createResource({
		url: 'lms.lms.api.get_sidebar_settings',
		cache: 'Sidebar Settings',
		auto: false,
	})

	return {
		user,
		isLoggedIn,
		login,
		logout,
		brand,
		branding,
		sidebarSettings,
	}
})
