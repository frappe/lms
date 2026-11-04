// @ts-expect-error utils/dialogs.js is still plain JS, so it has no declarations
import { createDialog } from '@/utils/dialogs'
import { deleteRow } from '@/components/Settings/rowActions'
import type { SettingsListColumn, SettingsListRow } from '@/types'

/**
 * Settings > Payment Gateways, as data: what the list fetches, what a row
 * says, what its menu can do. Every translated string is produced inside a
 * function or getter, since `__` is installed on window by
 * translationPlugin after main.js finishes importing the settings tree.
 */

export const DOCTYPE = 'Payment Gateway'

/** The id the form opens on for a gateway that does not exist yet. */
export const NEW_GATEWAY = 'new'

/**
 * A Payment Gateway row names the doctype holding its credentials in
 * `gateway_settings` and the record in `gateway_controller`, both null for
 * a Single. The form reads all three, which is why the list fetches them.
 */
export const gatewayList = {
	doctype: DOCTYPE,
	fields: ['name', 'gateway_settings', 'gateway_controller'],
	searchFields: ['name', 'gateway_settings'],
	orderBy: 'modified desc',
}

export const emptyState = {
	name: 'Payment Gateways',
	icon: 'lucide-dollar-sign',
}

/** The provider's own name, e.g. `Razorpay Settings` → `Razorpay`. */
export const SETTINGS_SUFFIX = ' Settings'

export const providerName = (doctype: string) =>
	doctype.endsWith(SETTINGS_SUFFIX)
		? doctype.slice(0, -SETTINGS_SUFFIX.length)
		: doctype

const settingsDoctype = (row: SettingsListRow) =>
	row.gateway_settings || `${row.name}${SETTINGS_SUFFIX}`

const removeGateway = deleteRow(
	DOCTYPE,
	'Payment gateway deleted successfully',
	'Error deleting payment gateway'
)

// The same confirmation the other settings lists put a delete behind. It says
// what is left behind too: deleting the gateway unlists it, but the credentials
// live in their own doctype and stay where they are.
const confirmDeletion = (row: SettingsListRow) => {
	createDialog({
		title: __('Delete {0}?').format(row.name),
		message: __(
			'This stops {0} being offered at checkout. Its credentials remain in {1}.'
		).format(row.name, settingsDoctype(row)),
		size: 'sm',
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					removeGateway(row).then(close)
				},
			},
		],
	})
}

export const columns: SettingsListColumn[] = [
	{
		key: 'gateway',
		get label() {
			return __('Gateway')
		},
		type: 'stacked',
		primary: (row) => row.name,
		secondary: settingsDoctype,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.name),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				theme: 'red' as const,
				onClick: () => confirmDeletion(row),
			},
		],
	},
]
