import { markRaw } from 'vue'
import { deleteRow } from '@/components/Settings/rowActions'
import GoogleCalendarDetail from '@/components/Settings/GoogleCalendar/GoogleCalendarDetail.vue'
import type { ListPage } from '@/types/settingsSchema'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const DOCTYPE = 'Google Calendar'

const calendarLabel = (row: SettingsListRow): string =>
	row.calendar_name || row.name || ''

const removeCalendar = deleteRow(
	DOCTYPE,
	'Google Calendar deleted successfully',
	'Error deleting Google Calendar'
)

// Every header is a getter, for the same reason googleMeet.ts's are: `__` is
// installed on window only after every static import has settled.
const columns: SettingsListColumn[] = [
	{
		key: 'calendar',
		get label() {
			return __('Calendar')
		},
		type: 'stacked',
		primary: (row) => calendarLabel(row),
		secondary: (row) => row.user || '',
	},
	{
		key: 'authorization',
		get label() {
			return __('Authorization')
		},
		type: 'badge',
		// `authorization_code` is a Password field: this is always the dummy
		// mask or empty, never the real code, so a truthy check is safe to
		// select and draw without ever exposing anything.
		badges: (row) => [
			row.authorization_code
				? { label: __('Authorized'), theme: 'green' }
				: { label: __('Not authorized'), theme: 'gray' },
		],
	},
	{
		key: 'status',
		get label() {
			return __('Status')
		},
		type: 'badge',
		badges: (row) => [
			row.enable
				? { label: __('Enabled'), theme: 'green' }
				: { label: __('Disabled'), theme: 'gray' },
		],
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(calendarLabel(row)),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => removeCalendar(row),
			},
		],
	},
]

const detail = {
	kind: 'custom' as const,
	component: markRaw(GoogleCalendarDetail),
}

export const googleCalendarSettingsPage: ListPage = {
	kind: 'list',
	resource: {
		doctype: DOCTYPE,
		fields: ['name', 'calendar_name', 'user', 'enable', 'authorization_code'],
		searchFields: ['calendar_name', 'user'],
	},
	columns,
	searchable: true,
	empty: { name: 'Google Calendar', icon: 'lucide-calendar' },
	create: { detail },
	rowDetail: detail,
	requiresGoogleApi: true,
}
