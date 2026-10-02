/**
 * frappe-ui SidebarItem's row, for the one onboarding row that cannot be a
 * SidebarItem: a step row, whose tick toggle would end up a button inside
 * SidebarItem's own button. Kept identical to SidebarItem.vue (a test compares
 * a rendered SidebarItem against these), with logical padding for RTL.
 */
export const SIDEBAR_ROW =
	'group/sidebar-item flex h-7 items-center rounded-4 transition text-ink-gray-6 hover:bg-surface-gray-2'

export const SIDEBAR_ROW_CONTROL =
	'flex h-full min-w-0 flex-1 items-center rounded-4 focus-visible:ring-0 focus-visible:focus-ring'

/** The nav icon: SidebarItem's default prefix glyph. */
export const SIDEBAR_ICON = 'size-4'

/** Row and button label text in the onboarding panel. */
export const ROW_TEXT = 'text-p-sm'
