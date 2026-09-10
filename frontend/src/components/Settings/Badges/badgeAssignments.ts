import { toast } from 'frappe-ui'
import { deleteRow } from '@/components/Settings/rowActions'
import { recordForm } from '@/components/Settings/recordForm'
import dayjs from '@/utils/dayjs'
import type { ListPage } from '@/types/settingsSchema'
import type { SettingsListColumn, SettingsListRow } from '@/types'

/**
 * Settings > Badge Assignments, as config. A badge whose event is Manual
 * Assignment is awarded from here, and every badge's holders are listed here.
 */

const DOCTYPE = 'LMS Badge Assignment'

const removeAssignment = deleteRow(
	DOCTYPE,
	'Badge assignment deleted successfully',
	'Error deleting badge assignment'
)

// Every header is a getter. A config module is evaluated before the translation
// plugin installs `__` on window.
const columns: SettingsListColumn[] = [
	{
		key: 'member',
		get label() {
			return __('Member')
		},
		type: 'stacked',
		width: 'minmax(0, 1.6fr)',
		primary: (row) => row.member_name || row.member,
		secondary: (row) => row.member_username,
		avatar: (row) => ({ image: row.member_image, label: row.member_name }),
	},
	{
		key: 'badge',
		get label() {
			return __('Badge')
		},
		type: 'text',
		value: (row) => row.badge,
	},
	{
		key: 'issued_on',
		get label() {
			return __('Issued On')
		},
		type: 'text',
		value: (row: SettingsListRow) =>
			row.issued_on ? dayjs(row.issued_on).format('DD MMM YYYY') : '',
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) =>
			__('Actions for {0}').format(row.member_name || row.member),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				theme: 'red',
				onClick: () => removeAssignment(row),
			},
		],
	},
]

const form = recordForm({
	doctype: DOCTYPE,
	newTitle: () => __('Assign a Badge'),
	recordTitle: (row) => row.member_name || row.member || __('Badge Assignment'),
	sections: [
		{
			fields: [
				{
					name: 'member',
					label: 'Member',
					type: 'link',
					doctype: 'User',
					reqd: true,
				},
				{
					name: 'badge',
					label: 'Badge',
					type: 'link',
					doctype: 'LMS Badge',
					reqd: true,
				},
				{ name: 'issued_on', label: 'Issued On', type: 'date', reqd: true },
			],
		},
	],
	validate: (doc) => {
		if (!doc.member) return __('Member is required')
		if (!doc.badge) return __('Badge is required')
		if (!doc.issued_on) return __('Issued On is required')
		return ''
	},
	onSaved: ({ created, back }) => {
		toast.success(
			created
				? __('Badge assigned successfully')
				: __('Badge assignment updated successfully')
		)
		back()
	},
})

export const badgeAssignmentsSettingsPage: ListPage = {
	kind: 'list',
	resource: {
		doctype: DOCTYPE,
		fields: [
			'name',
			'member',
			'member_name',
			'member_username',
			'member_image',
			'issued_on',
			'badge',
		],
		searchFields: ['member_name', 'member', 'badge'],
		orderBy: 'issued_on desc',
	},
	columns,
	searchable: true,
	empty: { name: 'Badge Assignments', icon: 'lucide-award' },
	create: { label: 'Assign', detail: form.forNew() },
	rowDetail: form.forRecord(),
}
