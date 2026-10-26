// SidebarItem's row classes for the step row, which cannot be a SidebarItem:
// its tick toggle would nest a button in SidebarItem's own button. A test
// keeps these equal to a rendered SidebarItem.
export const SIDEBAR_ROW =
	'group/sidebar-item flex h-7 items-center rounded-4 transition text-ink-gray-6 hover:bg-surface-gray-2'

export const SIDEBAR_ROW_CONTROL =
	'flex h-full min-w-0 flex-1 items-center rounded-4 focus-visible:ring-0 focus-visible:focus-ring'

/** The nav icon: SidebarItem's default prefix glyph. */
export const SIDEBAR_ICON = 'size-4'

/** Row and button label text in the onboarding panel. */
export const ROW_TEXT = 'text-p-sm'
