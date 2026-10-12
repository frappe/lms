import { usersStore } from '@/stores/user'

/**
 * Whether the signed-in user may see the Google API / Google Calendar
 * settings panels. Neither doctype's DocPerms cover a plain Moderator, so
 * an ungated panel throws a permission error the instant it fetches.
 */
export const canManageGoogleIntegrations = (): boolean => {
	const { userResource } = usersStore()
	return Boolean(userResource?.data?.is_system_manager)
}
