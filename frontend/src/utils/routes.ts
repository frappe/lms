import type { RouteLocationRaw } from 'vue-router'

/* Returns null when the username is missing, since /user/:username is a
   required param and router-link resolves `to` while rendering. */
export function profileRoute(
	username?: string | null,
	name = 'Profile'
): RouteLocationRaw | null {
	if (!username) return null
	return { name, params: { username } }
}
