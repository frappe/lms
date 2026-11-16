import type { CloudContext } from '@frappe/cloud-sdk'
import { usersStore } from '@/stores/user'

export const cloudContext = (): CloudContext | undefined =>
	usersStore().userResource.data?.cloud_settings

// Frappe enables it only for System Managers on a Frappe Cloud v2 site
export const hasCloudSettings = (): boolean => cloudContext()?.enabled === true

// A System Manager on a Frappe Cloud v1 site keeps the old trial banner and login
export const isV1CloudAdmin = (): boolean => {
	const user = usersStore().userResource.data
	return !!user?.is_system_manager && !!user.is_fc_site && !hasCloudSettings()
}

// LMS's __ returns a { format } object for a placeholder message given no
// values, so always pass an array to get a string back.
export const translate = (message: string, values?: unknown[]): string =>
	__(message, (values ?? []) as (string | number)[])
