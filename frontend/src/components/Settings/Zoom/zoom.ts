import { defineAsyncComponent, markRaw } from 'vue'
import { call, toast } from 'frappe-ui'
import { reloadSettingsLists } from '@/composables/useSettingsListResource'
import { cleanError } from '@/utils'
import type { ListPage } from '@/types/settingsSchema'
import type { SettingsListColumn, SettingsListRow } from '@/types'

/**
 * Zoom accounts: the list, as data, and one component for the account behind a
 * row. What was ZoomSettings.vue is gone — the list, the New affordance and the
 * swap to a form are what every settings list does, and SettingsListPanel does
 * them once. What is left here is only what was ever Zoom's: which doctype,
 * which columns, and what a row's menu can do.
 */

const DOCTYPE = 'LMS Zoom Settings'

// `autoname: field:account_name`, so a row's doc name IS its account name.
// Both are read because a deep link can open a record the list has not fetched.
const accountLabel = (row: SettingsListRow): string =>
	row.account_name || row.name || ''

/**
 * Optimistic, with a rollback. The row flips under the pointer and the write
 * follows it; a rejected write puts the row back to the value it held before.
 * Nothing reloads the list here, so without the rollback the row would keep
 * showing a state the server refused.
 */
const toggleEnabled = async (row: SettingsListRow, value: boolean) => {
	const previous = row.enabled
	row.enabled = value ? 1 : 0
	try {
		await call('frappe.client.set_value', {
			doctype: DOCTYPE,
			name: row.name,
			fieldname: 'enabled',
			value: row.enabled,
		})
	} catch (err: any) {
		row.enabled = previous
		toast.error(cleanError(err.messages?.[0] || err))
	}
}

/**
 * The row menu's Delete. A config module is handed the row and nothing else, so
 * it asks every list on screen for that doctype to refetch rather than reaching
 * for the resource behind this one — which is also what keeps the list on its
 * first page, where the removed row was.
 */
const removeAccount = async (row: SettingsListRow) => {
	try {
		await call('frappe.client.delete', { doctype: DOCTYPE, name: row.name })
		toast.success(__('Zoom account deleted successfully'))
		await reloadSettingsLists(DOCTYPE)
	} catch (err: any) {
		toast.error(cleanError(err.messages?.[0] || err))
	}
}

// Every header is a getter, and that is not decoration. `__` is installed on
// window by the translation plugin in main.js, which runs after every static
// import has already been evaluated — so a config module that called it while
// building this array would call an undefined global. A getter defers the
// lookup to the moment the list renders, which is where the component this
// replaces called it from setup().
const columns: SettingsListColumn[] = [
	{
		key: 'account',
		get label() {
			return __('Account')
		},
		type: 'stacked',
		primary: (row) => accountLabel(row),
		secondary: (row) => row.account_id,
	},
	{
		key: 'member',
		get label() {
			return __('Member')
		},
		type: 'text',
		value: (row) => row.member_name,
		avatar: (row) => ({ image: row.member_image, label: row.member_name }),
	},
	{
		key: 'enabled',
		get label() {
			return __('Enabled')
		},
		type: 'switch',
		width: '6.5rem',
		checked: (row) => Boolean(row.enabled),
		ariaLabel: (row) => __('Enable {0}').format(accountLabel(row)),
		onChange: toggleEnabled,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(accountLabel(row)),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => removeAccount(row),
			},
		],
	},
]

/**
 * One component for New and for an existing account alike: it is handed the
 * record the panel opened, and 'new' is a record name like any other.
 *
 * A `kind: 'custom'` detail rather than a fields page, because a set of
 * credentials is not a list of settings rows — see ZoomAccountForm.vue.
 *
 * Loaded on demand, the way Email Accounts loads its form: the list is what
 * opens, and the form is a component with a document resource behind it.
 */
const accountForm = {
	kind: 'custom' as const,
	component: markRaw(
		defineAsyncComponent(() => import('./ZoomAccountForm.vue'))
	),
}

export const zoomSettingsPage: ListPage = {
	kind: 'list',
	resource: {
		doctype: DOCTYPE,
		fields: [
			'name',
			'enabled',
			'account_name',
			'member',
			'member_name',
			'member_image',
			'account_id',
			'client_id',
			'client_secret',
		],
		searchFields: ['account_name', 'account_id', 'member_name'],
	},
	columns,
	searchable: true,
	empty: { name: 'Zoom Settings', icon: 'lucide-video' },
	create: { detail: accountForm },
	rowDetail: accountForm,
}
