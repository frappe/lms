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
}
