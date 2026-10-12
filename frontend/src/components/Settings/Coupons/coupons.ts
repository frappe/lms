// @ts-expect-error utils/dialogs.js is still plain JS, so it has no declarations
import { createDialog } from '@/utils/dialogs'
import {
	deleteRow,
	setRowField,
	toggleRowField,
} from '@/components/Settings/rowActions'
import dayjs from '@/utils/dayjs'
import type { SettingsListResourceOptions } from '@/composables/useSettingsListResource'
import type { SelectOption } from '@/types/settingsSchema'
import type { SettingsListColumn, SettingsListRow } from '@/types'

/**
 * Settings > Coupons, as config: what a coupon is (doctype, columns,
 * choices). Every translated string is produced inside a function or
 * getter, since `__` is installed on window by translationPlugin after
 * this module evaluates, so a `__()` at module scope would call undefined.
 */

export const COUPON_DOCTYPE = 'LMS Coupon'

export const couponListOptions: SettingsListResourceOptions = {
	doctype: COUPON_DOCTYPE,
	fields: [
		'name',
		'code',
		'discount_type',
		'percentage_discount',
		'fixed_amount_discount',
		'expires_on',
		'usage_limit',
		'redemption_count',
		'enabled',
	],
	searchFields: ['code'],
}

export const discountTypeOptions = (): SelectOption[] => [
	{ label: __('Percentage'), value: 'Percentage' },
	{ label: __('Fixed Amount'), value: 'Fixed Amount' },
]

/** What an applicable item can point at, the child table's own Select. */
export const applicableDoctypeOptions = (): SelectOption[] => [
	{ label: __('Course'), value: 'LMS Course' },
	{ label: __('Batch'), value: 'LMS Batch' },
]

/**
 * A new coupon before it exists. `enabled` is seeded rather than left to
 * the doctype default, so the header switch says what will be saved. The
 * child table starts empty, since the form drops unchosen rows on save anyway.
 */
export const newCoupon = (): SettingsListRow => ({
	enabled: 1,
	discount_type: 'Percentage',
	applicable_items: [],
})

export const discountLabel = (row: SettingsListRow): string => {
	if (row.discount_type === 'Percentage') return `${row.percentage_discount}%`
	if (row.discount_type === 'Fixed Amount')
		return `${row.fixed_amount_discount}/-`
	return ''
}

// A coupon with no expiry never expires, and dayjs(null) is an Invalid
// Date, so the cell is left blank rather than filled with one.
const expiryLabel = (row: SettingsListRow): string =>
	row.expires_on ? dayjs(row.expires_on).format('DD MMM YYYY') : ''

// A coupon with no usage limit can be redeemed any number of times, so there is
// no denominator to draw and the count stands alone.
const redeemedLabel = (row: SettingsListRow): string => {
	const count = row.redemption_count || 0
	return row.usage_limit ? `${count}/${row.usage_limit}` : String(count)
}

/**
 * Optimistic, with a rollback: the row flips under the pointer and the
 * write follows; a rejected write puts it back. Nothing else reloads the
 * list, so without this the row would keep showing a state the server refused.
 */
const toggleEnabled = toggleRowField(
	setRowField(COUPON_DOCTYPE),
	'Error updating coupon'
)

const removeCoupon = deleteRow(
	COUPON_DOCTYPE,
	'Coupon deleted successfully',
	'Error deleting coupon'
)

const confirmDeletion = (row: SettingsListRow) => {
	createDialog({
		title: __('Delete {0}?').format(row.code),
		message: __(
			'This will permanently delete the coupon and the code will no longer be valid.'
		),
		size: 'sm',
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					removeCoupon(row).then(close)
				},
			},
		],
	})
}

export const couponColumns: SettingsListColumn[] = [
	{
		key: 'code',
		get label() {
			return __('Code')
		},
		type: 'stacked',
		width: 'minmax(0, 1.4fr)',
		primary: (row) => row.code,
	},
	{
		key: 'discount',
		get label() {
			return __('Discount')
		},
		type: 'text',
		value: discountLabel,
	},
	{
		key: 'expires_on',
		get label() {
			return __('Expires On')
		},
		type: 'text',
		value: expiryLabel,
	},
	{
		key: 'redeemed',
		get label() {
			return __('Redeemed')
		},
		type: 'text',
		width: '6rem',
		value: redeemedLabel,
	},
	{
		// A switch, not a status badge: whether a code still works is a thing to
		// change from the list, and a badge only reported it. Same column shape
		// Badges and Zoom accounts use, optimistic write and all.
		key: 'enabled',
		get label() {
			return __('Enabled')
		},
		type: 'switch',
		width: '6.5rem',
		checked: (row) => Boolean(row.enabled),
		ariaLabel: (row) => __('Enable {0}').format(row.code),
		onChange: toggleEnabled,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.code),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => confirmDeletion(row),
			},
		],
	},
]
