import type { Component } from 'vue'
import type { SettingsListColumn, SettingsListRow } from '@/types/settingsList'

/**
 * The settings tree, as data: a page of fields, a page of records, or a
 * component. The kind is a discriminant, so a renderer never branches on a
 * panel's name.
 */

export interface SelectOption {
	label: string
	value: string
}

export type FieldOptions = string[] | SelectOption[]

interface FieldBase {
	/** Fieldname on the page's source document. */
	name: string
	label: string
	description?: string
	placeholder?: string
	reqd?: boolean
	/**
	 * Shown, never written. For a value the document records rather than
	 * accepts (Transactions' member consent, Coupons' redemption count), where
	 * hiding it would lose what the page reports.
	 */
	disabled?: boolean
	/**
	 * Hides the field unless the document says otherwise. Transactions' coupon
	 * block is the only caller. A hidden field is not written and not validated.
	 */
	showIf?: (doc: SettingsListRow) => boolean
}

/**
 * Value a control SHOWS while the document's own field is empty; never
 * written into it. Seeding it would make the document differ from
 * `originalDoc`, so it would report dirty on open and never reach "Saved".
 *
 * Unlike checkbox `default`, which IS written: Frappe returns a null
 * checkbox as off but saves nothing, so `default: 1` would silently flip off
 * on the next save of anything else on the page.
 */
interface DisplayFallback {
	displayFallback?: string
}

/**
 * A discriminated union, not a bare string. frappe-ui's FormControl falls
 * through to `<TextInput :type>` for anything it doesn't recognize, so a
 * mistyped `type` would render silently instead of failing to compile.
 */
export type SettingsField =
	| (FieldBase & {
			type: 'text' | 'email' | 'password' | 'number'
			/**
			 * A floor for a `number` field, enforced not merely suggested: an
			 * invalid value reverts to the last good one on blur. Declare it
			 * wherever validate() would throw; a rejected autosave can't retry.
			 */
			min?: number
			/**
			 * Draw the control across the row with its label above, the way
			 * `textarea` and `richtext` are drawn, instead of in the 12rem column
			 * on the end edge.
			 *
			 * For a one-line value that is nonetheless long: an Email Template's
			 * subject is a sentence carrying Jinja placeholders, and 12rem showed
			 * the user "Your batch {{ batch }} star" and stopped. Not a textarea
			 * instead — a control that accepts a newline would be lying about a
			 * field the server stores as one line.
			 */
			fullWidth?: boolean
	  })
	| (FieldBase & { type: 'textarea'; rows?: number })
	| (FieldBase & DisplayFallback & { type: 'select'; options: FieldOptions })
	| (FieldBase & { type: 'combobox'; options: FieldOptions })
	| (FieldBase &
			DisplayFallback & {
				type: 'link'
				/** A function when the target depends on another field, as LMS Payment's does. */
				doctype: string | ((doc: SettingsListRow) => string)
				/**
				 * Passed to search_link as-is. A bench also running Frappe CRM gets
				 * an `enabled` Check field on Email Template; frappe's search_widget
				 * appends `enabled = 1` unless the caller sends `include_disabled`.
				 */
				filters?: Record<string, unknown>
				onCreate?: (value: string, close: () => void) => void
			})
	| (FieldBase & { type: 'checkbox'; default?: 0 | 1 })
	| (FieldBase & { type: 'date' })
	| (FieldBase & {
			type: 'code'
			mode: 'htmlmixed' | 'javascript'
			rows?: number
	  })
	/**
	 * A body of prose with a toolbar. Full-width, label above, for the same
	 * reason as `code` and `textarea`: the 12rem end column is one line tall,
	 * and a toolbar plus several lines can't live there.
	 */
	| (FieldBase & {
			type: 'richtext'
			/**
			 * Lines of content the control is sized for, same as `textarea`. Two
			 * fields that swap for one another (Email Template's HTML body and its
			 * rich one) declare the same number so the swap moves nothing below.
			 */
			rows?: number
	  })
	| (FieldBase & {
			type: 'upload'
			/** The placeholder icon shown before anything is uploaded. */
			icon?: string
			/**
			 * Opt in to a world-readable file. Everything else keeps frappe's private
			 * default; gateway KYC documents and merchant QR codes reach these pages.
			 */
			public?: boolean
			size?: 'lg'
	  })

export type SettingsFieldType = SettingsField['type']

export interface FieldsSection {
	label?: string
	fields: SettingsField[]
}

/**
 * Which document a page reads and writes. Not every panel writes LMS Settings:
 * Zoom and Google Meet have their own doctypes, and a detail page's record comes
 * from the URL.
 */
export type SettingsSource =
	| { doc: 'LMS Settings' }
	| { doctype: string; name: string }
	| { doctype: string; record: 'route' }

/** Runtime field metadata, e.g. LMS Payment's server-declared `reqd` flags. */
export type FieldMeta = Record<string, { reqd?: boolean | 0 | 1 }>

export interface FieldsPage {
	kind: 'fields'
	source: SettingsSource
	/** Autosave on commit, or an explicit Save button. */
	save: 'auto' | 'manual'
	sections: FieldsSection[]
	/**
	 * Supplies `reqd` at runtime where the server owns it. A field's own `reqd`
	 * stands where no meta is returned for it.
	 */
	meta?: () => Promise<FieldMeta>
	/**
	 * Hoists a toggle for this fieldname into the page header. Lives here
	 * rather than on DetailPage because the panel owns the header and is typed
	 * `page: FieldsPage`; a detail-only key would need a cast to reach.
	 */
	enabledField?: string
	/**
	 * The fieldname whose value IS the document's name: 'account_name' for Zoom
	 * and Google Meet (autoname from it), 'name' for an Email Template.
	 *
	 * Editing it renames the record via `rename_doc` first, then the other
	 * fields. Without this, an edit to that field is silently dropped, and the
	 * record keeps the name it was created with.
	 */
	renameField?: string
	/**
	 * What a new record opens holding, seeded into the draft and used as the
	 * baseline it is dirty against.
	 */
	defaults?: () => Record<string, unknown>
	/**
	 * The first thing wrong with the document, or '' when it is fine. Named here
	 * rather than left to the server, which answers one missing field per round
	 * trip. Additive: everything past the first still has to survive a refusal.
	 */
	validate?: (doc: SettingsListRow) => string
	/**
	 * Ran once a manual save lands, holding what a hand-drawn form put after its
	 * own write: the success toast, the telemetry, and `back` to the list.
	 */
	onSaved?: (context: {
		created: boolean
		name: string | null
		back: () => void
	}) => void
}

export interface SettingsListSource {
	doctype: string
	fields: string[]
	filters?: Record<string, unknown>
	orderBy?: string
	/**
	 * Which columns the search box matches, as `like` orFilters.
	 * `useSettingsListResource` builds the search from this list alone; it
	 * can't derive from `fields`, which would `like`-match check/int columns.
	 */
	searchFields?: string[]
	/** A whitelisted method returning rows, for catalogues with no doctype behind them. */
	method?: string
	/**
	 * Page size the rows arrive in, when not the panel's own. A method
	 * returning a whole catalogue in one call must declare a size no
	 * catalogue will reach, or Load More offers a page that doesn't exist.
	 */
	pageLength?: number
	/** Defaults to 'name'; catalogues keyed by something else say so. */
	rowKey?: string
}

/**
 * A record page behind a list row, reached by the back-button header.
 *
 * `title` is called with an empty row for a create form, and for a deep link
 * to a record the list hasn't fetched yet; every implementation must tolerate
 * that rather than assume a loaded row.
 */
export type DetailPage =
	| (FieldsPage & { title: (row: SettingsListRow) => string })
	| { kind: 'custom'; component: Component }

export interface ListPage {
	kind: 'list'
	resource: SettingsListSource
	columns: SettingsListColumn[]
	searchable?: boolean
	empty?: { name: string; icon?: string }
	create?: { label?: string; detail: DetailPage }
	rowDetail?: DetailPage
}

export interface CustomPage {
	kind: 'custom'
	component: Component
}

export type SettingsPage = FieldsPage | ListPage | CustomPage

/**
 * The slice of an item the URL layer needs. `useSettingsHash` resolves a hash to
 * a slug and back; it has no business knowing what a page renders, and taking
 * the narrow type is what lets its tests declare two-line fixtures.
 */
export interface SettingsRoutableItem {
	label: string
	/**
	 * The URL segment. Declared, never derived from the label: 'Payment >
	 * Configuration' and 'Communication > Templates' both slugify badly, and
	 * renaming a label would silently break every bookmark.
	 */
	slug: string
	/**
	 * Opt in to '#settings/<slug>/<record>'. Without it a second hash segment is
	 * stripped, so a page with no detail view cannot grow a phantom record id.
	 */
	records?: boolean
}

export interface SettingsRoutableGroup {
	label: string
	hideLabel?: boolean
	items: SettingsRoutableItem[]
}

export interface SettingsItem extends SettingsRoutableItem {
	icon: string
	condition?: () => boolean
	page: SettingsPage
}

export interface SettingsGroup extends SettingsRoutableGroup {
	items: SettingsItem[]
}
