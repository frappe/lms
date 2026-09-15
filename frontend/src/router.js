import { createRouter, createWebHistory } from 'vue-router'
import { call } from 'frappe-ui'
import { usersStore } from './stores/user'
import { sessionStore } from './stores/session'
import { useSettings } from './stores/settings'
import { getLmsBasePath } from './utils/basePath'
import { routes } from './routes'

// Run the fresh-site-admin persona check at most once per app load.
let personaChecked = false

async function shouldCapturePersona() {
	const captured = await call('frappe.client.get_single_value', {
		doctype: 'LMS Settings',
		field: 'persona_captured',
	})
	if (captured) return false
	const courseCount = await call('frappe.client.get_count', {
		doctype: 'LMS Course',
		filters: {
			title: ['not like', '%A guide to Frappe Learning%'],
		},
	})
	return !courseCount
}

let router = createRouter({
	history: createWebHistory(`/${getLmsBasePath()}`),
	routes,
})

export async function guardNavigation(to, from, next) {
	// Query- or hash-only navigations stay on the page already passed the checks
	// below. `from.name` must be set, or the initial navigation (from
	// START_LOCATION) to an unnamed route would skip the checks entirely.
	if (from.name && to.name === from.name && to.path === from.path) {
		return next()
	}

	const { userResource } = usersStore()
	let { isLoggedIn } = sessionStore()
	const { settings } = useSettings()

	try {
		if (isLoggedIn) {
			await userResource.promise
		}
	} catch (error) {
		isLoggedIn = false
	}

	if (!isLoggedIn) {
		if (to.name == 'Home') router.push({ name: 'Courses' })

		await settings.promise
		if (!settings.data.allow_guest_access) {
			window.location.href = '/login'
			return
		}
	}

	if (
		isLoggedIn &&
		!personaChecked &&
		to.name !== 'PersonaForm' &&
		userResource.data?.is_system_manager &&
		!userResource.data?.developer_mode
	) {
		personaChecked = true
		try {
			if (await shouldCapturePersona()) {
				return next({ name: 'PersonaForm' })
			}
		} catch (_) {
			// Fail open: a transient API error must not block navigation.
		}
	}

	return next()
}

router.beforeEach(guardNavigation)

export default router
