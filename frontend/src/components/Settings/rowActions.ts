import { call, toast } from 'frappe-ui'
import { reloadSettingsLists } from '@/composables/useSettingsListResource'
import { cleanError } from '@/utils'
import type { SettingsListRow } from '@/types'

/**
 * The two things a settings list's rows do to themselves. Both were written out
 * per panel, and both take their wording untranslated: a config module is
 * evaluated before the translation plugin installs `__` on window.
 */

const report = (err: any, fallback: string) =>
	toast.error(cleanError(err?.messages?.[0] || err) || __(fallback))

/** Writes one field on one row, for the toggle a list column offers. */
export const setRowField =
	(doctype: string, field = 'enabled') =>
	(row: SettingsListRow, value: 0 | 1) =>
		call('frappe.client.set_value', {
			doctype,
			name: row.name,
			fieldname: field,
			value,
		})

/**
 * Optimistic, with a rollback. The row flips under the pointer and the write
 * follows it. Nothing reloads the list here, so without the rollback a rejected
 * write would leave the row showing a state the server refused.
 */
export const toggleRowField = (
	write: (row: SettingsListRow, value: 0 | 1) => Promise<unknown>,
	failure: string,
	field = 'enabled'
) => {
	return async (row: SettingsListRow, value: boolean) => {
		const previous = row[field]
		row[field] = value ? 1 : 0
		try {
			await write(row, row[field] as 0 | 1)
		} catch (err: any) {
			row[field] = previous
			report(err, failure)
		}
	}
}

/**
 * The row menu's Delete. A config module is handed the row and nothing else, so
 * it asks every list on that doctype to refetch, which also keeps the list on
 * its first page.
 */
export const deleteRow = (
	doctype: string,
	success: string,
	failure: string
) => {
	return async (row: SettingsListRow) => {
		try {
			await call('frappe.client.delete', { doctype, name: row.name })
			toast.success(__(success))
			await reloadSettingsLists(doctype)
		} catch (err: any) {
			report(err, failure)
		}
	}
}
