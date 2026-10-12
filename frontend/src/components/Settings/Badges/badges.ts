import { toast } from 'frappe-ui'
import {
	deleteRow,
	setRowField,
	toggleRowField,
} from '@/components/Settings/rowActions'
import { recordForm } from '@/components/Settings/recordForm'
import type { ListPage, SelectOption } from '@/types/settingsSchema'
import type {
	SettingsListBadge,
	SettingsListColumn,
	SettingsListRow,
} from '@/types'

/**
 * Settings > Badges, as config: what the list shows and what the form offers.
 * SettingsListPanel draws both.
 */

const BADGE_DOCTYPE = 'LMS Badge'

/** LMS Badge autonames `field:title`, so editing the title renames the record. */
const BADGE_RENAME_FIELD = 'title'

const BADGE_FIELDS = [
	'name',
	'title',
	'enabled',
	'description',
	'image',
	'grant_only_once',
	'event',
	'reference_doctype',
	'condition',
	'user_field',
	'field_to_check',
]

const BADGE_SEARCH_FIELDS = ['title', 'description']

const DOCTYPE_LABELS: Record<string, () => string> = {
	'LMS Course': () => __('Course'),
	'LMS Batch': () => __('Batch'),
	'LMS Enrollment': () => __('Course Enrollment'),
	'LMS Batch Enrollment': () => __('Batch Enrollment'),
	'LMS Quiz Submission': () => __('Quiz Submission'),
	'LMS Assignment Submission': () => __('Assignment Submission'),
	'LMS Programming Exercise Submission': () =>
		__('Programming Exercise Submission'),
	Member: () => __('User'),
}

/**
 * The pill in the Awarded For column, and the one place that decides what a
 * reference doctype is called. Gray, like every other pill: eight tinted
 * pills down a column would read as status when none of them is one.
 */
const awardedFor = (doctype: string): SettingsListBadge => ({
	label: DOCTYPE_LABELS[doctype]?.() || doctype,
	theme: 'gray',
})

const toggleEnabled = toggleRowField(
	setRowField(BADGE_DOCTYPE),
	'Error updating badge'
)

const removeBadge = deleteRow(
	BADGE_DOCTYPE,
	'Badge deleted successfully',
	'Error deleting badge'
)

// Every header is a getter. A config module is evaluated before the
// translation plugin installs `__` on window.
const columns: SettingsListColumn[] = [
	{
		key: 'title',
		get label() {
			return __('Badge')
		},
		type: 'stacked',
		width: 'minmax(0, 1.6fr)',
		primary: (row) => row.title,
		avatar: (row) => ({ image: row.image, label: row.title }),
	},
	{
		key: 'reference_doctype',
		get label() {
			return __('Awarded For')
		},
		type: 'badge',
		badges: (row) => [awardedFor(row.reference_doctype)],
	},
	{
		// A switch, not a status badge: the state is a thing to change from here.
		key: 'enabled',
		get label() {
			return __('Enabled')
		},
		type: 'switch',
		width: '6.5rem',
		checked: (row) => Boolean(row.enabled),
		ariaLabel: (row) => __('Enable {0}').format(row.title),
		onChange: toggleEnabled,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.title),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				theme: 'red',
				onClick: () => removeBadge(row),
			},
		],
	},
]

const referenceDoctypeOptions = (): SelectOption[] => [
	{ label: __('Course'), value: 'LMS Course' },
	{ label: __('Batch'), value: 'LMS Batch' },
	{ label: __('User'), value: 'Member' },
	{ label: __('Quiz Submission'), value: 'LMS Quiz Submission' },
	{ label: __('Assignment Submission'), value: 'LMS Assignment Submission' },
	{
		label: __('Programming Exercise Submission'),
		value: 'LMS Programming Exercise Submission',
	},
	{ label: __('Course Enrollment'), value: 'LMS Enrollment' },
	{ label: __('Batch Enrollment'), value: 'LMS Batch Enrollment' },
]

const eventOptions = (): SelectOption[] =>
	['New', 'Value Change', 'Manual Assignment'].map((event) => ({
		label: __(event),
		value: event,
	}))

const userFieldOptions = (): SelectOption[] => [
	{ label: __('Member'), value: 'member' },
	{ label: __('Owner'), value: 'owner' },
]

// A condition is written here rather than merely checked, so the hint carries a
// worked example of each shape it can take.
const conditionHint = (): string =>
	__(
		'Manual Assignment takes JSON filters, e.g. {"published": 1}. Every other event takes an expression over `doc`, e.g. doc.progress == 100.'
	)

/** The fields a new badge opens on, before anything has been typed. */
const newBadge = (): Record<string, unknown> => ({
	title: '',
	enabled: 1,
	description: '',
	image: '',
	grant_only_once: 0,
	event: 'New',
	reference_doctype: '',
	condition: '',
	user_field: 'member',
})

/**
 * The badge itself, behind New and behind a row alike. The image sits under the
 * words it illustrates, and the rules that award it are their own section.
 */
const form = recordForm({
	doctype: BADGE_DOCTYPE,
	renameField: BADGE_RENAME_FIELD,
	enabledField: 'enabled',
	defaults: newBadge,
	newTitle: () => __('New Badge'),
	recordTitle: (row) => row.title || __('Badge'),
	sections: [
		{
			fields: [
				{
					name: 'title',
					label: 'Title',
					description: 'The name this badge is awarded and displayed under.',
					type: 'text',
					fullWidth: true,
					placeholder: 'e.g. Course Champion',
					reqd: true,
				},
				{
					name: 'description',
					label: 'Description',
					type: 'textarea',
					rows: 3,
					placeholder: 'What is this badge awarded for?',
					reqd: true,
				},
				{
					name: 'image',
					label: 'Badge Image',
					description: 'Shown wherever this badge is awarded.',
					type: 'upload',
					icon: 'lucide-award',
					// A badge is shown to every learner who earns one, so public is
					// what it has to be.
					public: true,
					reqd: true,
				},
			],
		},
		{
			label: 'Assignment rules',
			fields: [
				{
					name: 'grant_only_once',
					label: 'Grant Only Once',
					description: 'Each user can only receive this badge one time.',
					type: 'checkbox',
				},
				{
					name: 'reference_doctype',
					label: 'Assign For',
					description: 'The record whose events award this badge.',
					type: 'select',
					get options() {
						return referenceDoctypeOptions()
					},
					reqd: true,
				},
				{
					name: 'user_field',
					label: 'Assign To',
					description: 'Which user on that record receives it.',
					type: 'select',
					get options() {
						return userFieldOptions()
					},
					reqd: true,
				},
				{
					name: 'event',
					label: 'Event',
					description:
						'What awards it: a new record, a changed value, or a manual assignment.',
					type: 'select',
					get options() {
						return eventOptions()
					},
					reqd: true,
				},
				{
					name: 'condition',
					label: 'Condition',
					get description() {
						return conditionHint()
					},
					type: 'code',
					mode: 'javascript',
					rows: 10,
					reqd: true,
				},
			],
		},
	],
	// LMS Badge marks seven fields reqd, so the server would answer one gap per
	// round trip. Naming the first here is additive: everything past it still has
	// to survive the server saying no.
	validate: (doc) => {
		if (!doc.title) return __('Title is required')
		if (!doc.reference_doctype) return __('Assign For is required')
		if (!doc.description) return __('Description is required')
		if (!doc.image) return __('Badge Image is required')
		if (!doc.event) return __('Event is required')
		if (!doc.user_field) return __('Assign To is required')
		if (!doc.condition) return __('Condition is required')
		return ''
	},
	onSaved: ({ created, back }) => {
		toast.success(
			created
				? __('Badge created successfully')
				: __('Badge updated successfully')
		)
		back()
	},
})

export const badgesSettingsPage: ListPage = {
	kind: 'list',
	resource: {
		doctype: BADGE_DOCTYPE,
		fields: BADGE_FIELDS,
		searchFields: BADGE_SEARCH_FIELDS,
		orderBy: 'creation desc',
	},
	columns,
	searchable: true,
	empty: { name: 'Badges', icon: 'lucide-award' },
	create: { detail: form.forNew() },
	rowDetail: form.forRecord(),
}
