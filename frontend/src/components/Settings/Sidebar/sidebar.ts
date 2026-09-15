import { markRaw } from 'vue'
import type { SettingsItem } from '@/types/settingsSchema'
import type { LMSSidebarItem } from '@/types/lms/LMSSidebarItem'
import SidebarSettings from '@/components/Settings/Sidebar/SidebarSettings.vue'

// Re-exported, never re-declared: `utils/sidebarRows.ts` owns the client's copy
// of the rule, and a second `new Set(['home'])` here is a second thing to keep
// in step with the server's LOCKED_VISIBLE.
export { LOCKED_VISIBLE } from '@/utils/sidebarRows'

/**
 * Settings > Sidebar, as config. Every translated string is produced inside
 * a function: `__` is installed on window after the settings tree is
 * imported, so a `__()` at module scope would throw.
 */

/** The label a built-in row shows. Restated here rather than read from
 * `getSidebarItems()`, which needs a live user session to build. Keep this in
 * step with `utils/index.js` and with hooks.py's `standard_sidebar_items`. */
const BUILT_IN_LABELS: Record<string, () => string> = {
	home: () => __('Home'),
	search: () => __('Search'),
	notifications: () => __('Notifications'),
	courses: () => __('Courses'),
	programs: () => __('Programs'),
	batches: () => __('Batches'),
	certifications: () => __('Certifications'),
	jobs: () => __('Jobs'),
	statistics: () => __('Statistics'),
	contact_us: () => __('Contact Us'),
	quizzes: () => __('Quizzes'),
	assignments: () => __('Assignments'),
	programming_exercises: () => __('Programming Exercises'),
}

export const builtInLabel = (name1: string): string =>
	BUILT_IN_LABELS[name1]?.() ?? name1

/** The icon a built-in row's link draws, so the table matches the sidebar
 * instead of the generic fallback. Kept in step with `utils/index.js`'s
 * getSidebarItems(). */
const BUILT_IN_ICONS: Record<string, string> = {
	home: 'Home',
	search: 'Search',
	notifications: 'Bell',
	courses: 'BookOpen',
	programs: 'Route',
	batches: 'Users',
	certifications: 'GraduationCap',
	jobs: 'Briefcase',
	statistics: 'TrendingUp',
	contact_us: 'Mail',
	quizzes: 'CircleHelp',
	assignments: 'Pencil',
	programming_exercises: 'Code',
}

export const builtInIcon = (name1: string): string | undefined =>
	BUILT_IN_ICONS[name1]

/** What a row is called in the table: a built-in's own label, otherwise
 * whatever the row points at. */
export const rowLabel = (row: LMSSidebarItem): string => {
	if (row.item_type === 'Built-in') return builtInLabel(row.name1 ?? '')
	return row.title || row.web_page || row.route || row.url || __('Untitled')
}

// What the table's Type column shows. The label is not a spelling of the raw
// item_type, so the human word lives here rather than being read straight off
// the row.
const TYPE_LABELS = (): Record<string, string> => ({
	'Built-in': __('Built-in'),
	'Web Page': __('Web Page'),
	Route: __('Link within this site'),
	External: __('External link'),
})

export const sidebarTypeLabel = (itemType: string | null | undefined): string =>
	TYPE_LABELS()[itemType ?? ''] ?? itemType ?? ''

/**
 * An LMSSidebarItem plus a client-only key. A row added this session has no
 * server `name` until the next save, so matching on `name` would match
 * `undefined === undefined` and let a second Add silently overwrite the
 * first. `_clientId` finds the row instead, and is stripped before save.
 */
export type SidebarRowDraft = LMSSidebarItem & { _clientId?: string }

// crypto.randomUUID is secure-context only, undefined over plain http on a
// self-hosted setup. These ids never leave the browser, so a counter-based
// fallback needs no cryptographic quality.
let clientIdCounter = 0

export const newClientId = (): string =>
	globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${++clientIdCounter}`

export const sidebarSettingsPage: SettingsItem = {
	label: 'Sidebar',
	slug: 'sidebar',
	icon: 'lucide-panel-left',
	// A getter, not a property: this module and SidebarSettings.vue import
	// each other, and a property evaluated on the wrong import order throws
	// markRaw(undefined) — passes locally, dies in a lazy chunk.
	get page() {
		return { kind: 'custom' as const, component: markRaw(SidebarSettings) }
	},
}
