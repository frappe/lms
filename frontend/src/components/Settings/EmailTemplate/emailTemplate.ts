import { deleteRow } from '@/components/Settings/rowActions'
import { recordForm } from '@/components/Settings/recordForm'
import type { ListPage } from '@/types/settingsSchema'
import type { SettingsListColumn, SettingsListRow } from '@/types'

/**
 * Settings > Email Template, as config. `autoname: "Prompt"`, so `name`
 * is a plain field on the form rather than derived from another one.
 */

const DOCTYPE = 'Email Template'

const templateLabel = (row: SettingsListRow): string => row.name || ''

const removeTemplate = deleteRow(
	DOCTYPE,
	'Email template deleted successfully',
	'Error deleting email template'
)

const columns: SettingsListColumn[] = [
	{
		key: 'template',
		get label() {
			return __('Template')
		},
		type: 'stacked',
		primary: (row) => templateLabel(row),
		secondary: (row) => row.subject,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(templateLabel(row)),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => removeTemplate(row),
			},
		],
	},
]

// `response` and `response_html` are the same slot, swapped by Use HTML.
// Matching rows keeps the swap from moving anything below it.
const CONTENT_ROWS = 8

const form = recordForm({
	doctype: DOCTYPE,
	renameField: 'name',
	newTitle: () => __('New Email Template'),
	recordTitle: (row) => templateLabel(row) || __('Email Template'),
	// Name, Subject and Content are all bare fullWidth fields with no
	// description -- flush's usual "one block, no dividers" reads as dead air
	// between them here, not a single grouped thing.
	dividers: true,
	sections: [
		{
			fields: [
				{
					name: 'name',
					label: 'Name',
					type: 'text',
					fullWidth: true,
					reqd: true,
				},
				{
					name: 'subject',
					label: 'Subject',
					type: 'text',
					fullWidth: true,
					reqd: true,
				},
				{
					name: 'use_html',
					label: 'Use HTML',
					type: 'checkbox',
					description:
						'Write the content as raw HTML/Jinja instead of the rich text editor.',
				},
				{
					name: 'response',
					label: 'Content',
					type: 'richtext',
					rows: CONTENT_ROWS,
					reqd: true,
					showIf: (doc) => !doc.use_html,
				},
				{
					name: 'response_html',
					label: 'Content',
					type: 'code',
					mode: 'htmlmixed',
					rows: CONTENT_ROWS,
					reqd: true,
					showIf: (doc) => Boolean(doc.use_html),
				},
			],
		},
	],
})

export const emailTemplateSettingsPage: ListPage = {
	kind: 'list',
	resource: {
		doctype: DOCTYPE,
		fields: ['name', 'subject', 'use_html', 'response', 'response_html'],
		searchFields: ['name', 'subject'],
		orderBy: 'modified desc',
	},
	columns,
	searchable: true,
	empty: { name: 'Email Templates', icon: 'lucide-mail-plus' },
	create: { detail: form.forNew() },
	rowDetail: form.forRecord(),
}
