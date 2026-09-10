import { defineAsyncComponent, markRaw } from 'vue'
import { call, toast } from 'frappe-ui'
import { usersStore } from '@/stores/user'
import { reloadSettingsLists } from '@/composables/useSettingsListResource'
import { cleanError } from '@/utils'
import type { ListPage } from '@/types/settingsSchema'
import type { SettingsListColumn, SettingsListRow } from '@/types'

/**
 * Google Meet accounts: the list, as data, and one component for the account
 * behind a row. The same shape as Zoom, which is the same problem — a doctype of
 * accounts, one per evaluator, read as a list and edited as a record.
 *
 * What lives here is only what is Google Meet's: which doctype, who may see the
 * page, whose accounts it shows, what a row is made of, and what a row's menu
 * can do. SettingsListPanel does the rest, as it does for every list.
 */

const DOCTYPE = 'LMS Google Meet Settings'

// `autoname: field:account_name`, so a row's doc name IS its account name.
// Both are read because a deep link can open a record the list has not fetched.
const accountLabel = (row: SettingsListRow): string =>
	row.account_name || row.name || ''

// `member_name` is fetched from the member's full_name, which a User is not
// obliged to have. The email is then the only name the row has.
const memberLabel = (row: SettingsListRow): string =>
	row.member_name || row.member || ''

/**
 * Whose accounts this page shows. A moderator sees the site's; anyone else sees
 * their own, which is what GoogleMeetSettings.vue narrowed its resource to in
 * onMounted. It is an access control, not a display filter — the rows the
 * server sends are the rows the user may see.
 *
 * Read through the store rather than an injected `$user` because a config
 * module has no component to inject into, and called lazily for the same reason
 * the column labels are: pinia is installed in main.js, after this module has
 * been evaluated.
 */
export const memberScope = (): Record<string, unknown> => {
	const { userResource } = usersStore()
	const user = userResource?.data
	return user?.is_moderator ? {} : { member: user?.name }
}

/**
 * Whether the page belongs in the sidebar at all. The component this replaces
 * refused to fetch anything for a user who was neither a moderator nor an
 * evaluator, and a page has no say in whether its item is listed — so the guard
 * lives on the item as `condition`.
 */
export const canManageGoogleMeet = (): boolean => {
	const { userResource } = usersStore()
	const user = userResource?.data
	return Boolean(user?.is_moderator || user?.is_evaluator)
}

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
		toast.success(__('Google Meet account deleted successfully'))
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
//
// The account and its member share one column, as two lines of a `stacked`
// cell: an account is a person's, and reading the two side by side spent a
// third of the row on a column that never says anything the first does not.
// Both lines truncate, as does the calendar beside them — the values that
// overflow are a full name and a calendar id, and a row that wrapped either
// would be taller than the rest of the list.
const columns: SettingsListColumn[] = [
	{
		key: 'account',
		get label() {
			return __('Account')
		},
		type: 'stacked',
		primary: (row) => accountLabel(row),
		secondary: (row) => memberLabel(row),
		avatar: (row) => ({ image: row.member_image, label: memberLabel(row) }),
	},
	{
		key: 'calendar',
		get label() {
			return __('Google Calendar')
		},
		type: 'text',
		value: (row) => row.google_calendar || '',
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
 * A `kind: 'custom'` detail rather than a fields page, because the account name
 * is the document's own name and the other two fields are pickers with a
 * sentence each — see GoogleMeetAccountForm.vue.
 *
 * Loaded on demand, the way Zoom loads its form: the list is what opens, and
 * the form is a component with a document resource behind it.
 */
const accountForm = {
	kind: 'custom' as const,
	component: markRaw(
		defineAsyncComponent(() => import('./GoogleMeetAccountForm.vue'))
	),
}

export const googleMeetSettingsPage: ListPage = {
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
			'google_calendar',
		],
		// A getter, and read once by the panel at setup: the signed-in user is not
		// loaded when this module is first imported, which is why the component
		// this replaces applied the filter from onMounted rather than from setup.
		get filters() {
			return memberScope()
		},
		searchFields: ['account_name', 'member_name', 'google_calendar'],
	},
	columns,
	searchable: true,
	empty: { name: 'Google Meet Settings', icon: 'lucide-presentation' },
	create: { detail: accountForm },
	rowDetail: accountForm,
}
