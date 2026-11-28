import type { InjectionKey } from 'vue'

export interface SettingsSection {
	id: string
	title: string
	icon?: string
	name?: string
	element: HTMLElement
}

export interface SettingsSections {
	register: (section: SettingsSection) => void
	unregister: (id: string) => void
}

/** Lets each settings section list itself in the page's section nav. */
export const SETTINGS_SECTIONS: InjectionKey<SettingsSections> =
	Symbol('settingsSections')

/** Sections in the order they sit on the page, whatever order they mounted in. */
export function inPageOrder(sections: SettingsSection[]): SettingsSection[] {
	return [...sections].sort((a, b) =>
		a.element.compareDocumentPosition(b.element) &
		Node.DOCUMENT_POSITION_FOLLOWING
			? -1
			: 1
	)
}
