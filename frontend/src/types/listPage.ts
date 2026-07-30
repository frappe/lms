/** What a list page declares, shared by the layout components that render it. */

import type { RouteLocationRaw } from 'vue-router'

/** One crumb in a page's frappe-ui `Breadcrumbs` trail. */
export interface Breadcrumb {
	label: string
	route?: RouteLocationRaw
}

/** Which meaning a boolean filter carries when it is on. */
export type FilterChipTheme = 'gray' | 'green' | 'blue'

/** One column of a `ResponsiveListView`: a desk column, and a card line. */
export interface ListColumn {
	label: string
	key: string
	width?: number | string
	align?: string
	/** A `lucide-*` class, shown beside the desk column header. */
	icon?: string
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
}
