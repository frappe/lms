import type { Component } from 'vue'

export type SidebarLinkAction = 'commandPalette'

export interface SidebarLink {
	label: string
	icon: string | Component
	to?: string
	action?: SidebarLinkAction
	shortcut?: string
	panel?: string
	count?: number
	onlyMobile?: boolean
	activeFor?: string[]
	condition?: () => boolean
	/** Only a custom row carries this. 0 means handleClick must navigate in
	 * the same tab rather than through openExternal. */
	open_in_new_window?: 0 | 1
}

export type SidebarItemType = 'Built-in' | 'Web Page' | 'Route' | 'External'

/** One row of `LMS Settings.sidebar_items`, as `get_sidebar_settings` sends it. */
export interface SidebarRow {
	/** The child row's own name. Stable within a save, and the render key. */
	name: string
	name1: string
	item_type: SidebarItemType
	/** The real Web Page document name. Only a `Web Page` row carries one. */
	web_page: string | null
	hidden: 0 | 1
	is_standard: 0 | 1
	icon: string | null
	/** Null for a Built-in row: getSidebarItems() owns that label. */
	label: string | null
	to: string | null
	open_in_new_window: 0 | 1
}

export interface SidebarRenderLink {
	kind: 'link'
	key: string
	link: SidebarLink
}

/** The collapsible group the web pages have always been drawn in. */
export interface SidebarRenderAccordion {
	kind: 'accordion'
	key: string
	label: string
	items: SidebarRenderLink[]
}

export type SidebarRenderRow =
	/** The space the sidebar leaves between two built-in groups. Not a rule. */
	{ kind: 'gap'; key: string } | SidebarRenderLink | SidebarRenderAccordion
