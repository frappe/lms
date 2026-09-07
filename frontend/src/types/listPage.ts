/** What a list page declares, shared by the layout components that render it. */

import type { RouteLocationRaw } from 'vue-router'

/** One crumb in a page's frappe-ui `Breadcrumbs` trail. */
export interface Breadcrumb {
	label: string
	route?: RouteLocationRaw
}

/** One column of a `ResponsiveListView`: a desk column, and a card line. */
export interface ListColumn {
	label: string
	key: string
	width?: number | string
	align?: string
	/** A `lucide-*` class, shown beside the desk column header. */
	icon?: string
	kind?: 'data' | 'actions'
	/**
	 * Kept off the phone card. The desk row still shows it: a card line is
	 * read at a glance, so a page opts out of the values that only earn their
	 * place in a table it can scan.
	 */
	hideOnMobile?: boolean
}

export type ListRow = Record<string, unknown>

/**
 * How a page's rows are drawn. `grid` gives every row to the page's own card
 * component; `list` builds both the desk row and the phone card from
 * `ListColumn[]`.
 */
export type ListPageLayout = 'grid' | 'list'

/** The frappe-ui `ListView` options a list page actually sets. */
export interface ListViewOptions {
	selectable?: boolean
	showTooltip?: boolean
	onRowClick?: (row: ListRow) => void
	getRowRoute?: (row: ListRow) => RouteLocationRaw
	/* Names the selection in the banner, at both widths. Left unset,
	   ResponsiveListView supplies a translated count; frappe-ui's own fallback
	   is hardcoded English and is never reached. */
	selectionText?: (count: number) => string
}
