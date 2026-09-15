import { toast } from 'frappe-ui'
import { useTelemetry } from 'frappe-ui/frappe'
import {
	deleteRow,
	setRowField,
	toggleRowField,
} from '@/components/Settings/rowActions'
import { recordForm } from '@/components/Settings/recordForm'
import { openSettings } from '@/utils'
import type { ListPage } from '@/types/settingsSchema'
import type { SettingsListColumn, SettingsListRow } from '@/types'

/**
 * Zoom accounts: the list, as data, and one component for the account behind a
 * row. What is left here is only what was ever Zoom's: which doctype, which
 * columns, and what a row's menu can do.
 */

const DOCTYPE = 'LMS Zoom Settings'

// `autoname: field:account_name`, so a row's doc name IS its account name.
// Both are read because a deep link can open a record the list has not fetched.
const accountLabel = (row: SettingsListRow): string =>
	row.account_name || row.name || ''

const toggleEnabled = toggleRowField(
	setRowField(DOCTYPE),
	'Error updating Zoom account'
)

const removeAccount = deleteRow(
	DOCTYPE,
	'Zoom account deleted successfully',
	'Error deleting Zoom account'
)

// Every header is a getter, because `__` is installed on window by the
// translation plugin after every static import has been evaluated. A getter
// defers the lookup to the moment the list renders.
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

const form = recordForm({
	doctype: DOCTYPE,
	// `autoname: field:account_name`, so the account's name is the document's and
	// only a rename moves it.
	renameField: 'account_name',
	enabledField: 'enabled',
	newTitle: () => __('New Zoom Account'),
	recordTitle: (row) => accountLabel(row) || __('Zoom Account'),
	sections: [
		{
			fields: [
				{
					name: 'account_name',
					label: 'Account Name',
					type: 'text',
					reqd: true,
				},
				{ name: 'account_id', label: 'Account ID', type: 'text', reqd: true },
				{ name: 'client_id', label: 'Client ID', type: 'text', reqd: true },
				{
					name: 'client_secret',
					label: 'Client Secret',
					type: 'password',
					placeholder: '************',
					reqd: true,
				},
				{
					name: 'member',
					label: 'Member',
					description: 'The evaluator whose meetings these credentials host',
					type: 'link',
					doctype: 'Course Evaluator',
					reqd: true,
					onCreate: (_value, close) => openSettings('members', close),
				},
			],
		},
	],
	// Back to the list on success: a rename leaves the URL naming a document the
	// server has forgotten, and closing is what refetches the list.
	onSaved: ({ created, back }) => {
		toast.success(
			created
				? __('Zoom account created successfully')
				: __('Zoom account updated successfully')
		)
		if (created) useTelemetry().capture('zoom_account_linked')
		back()
	},
})

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
	create: { detail: form.forNew() },
	rowDetail: form.forRecord(),
}
