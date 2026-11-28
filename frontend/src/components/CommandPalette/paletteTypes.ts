import { getRecordRoute, type RecordRouteContext } from '@/utils/recordRoutes'

export interface PaletteRoute {
	name: string
	params?: Record<string, string>
	query?: Record<string, string>
}

export interface PaletteItem {
	title: string
	route?: PaletteRoute
	/** Narrows the search to this category instead of acting. */
	category?: string
	perform?: () => void
	doctype?: string
	name?: string
	/** A generated `lucide-*` class. */
	icon?: string
	/** Unix seconds, as the search index stores it. */
	modified?: number
	/** Belongs to a query the user has already replaced; shown, not selectable. */
	isStale?: boolean
}

export interface PaletteGroup {
	title: string
	items: PaletteItem[]
	isStale?: boolean
}

/** What the palette knows about the visitor when it picks a route. */
export type PaletteRouteContext = RecordRouteContext

/**
 * Routes that render as a modal over their list page. Both pages open them
 * through `openFormRoute`, which stamps the history entry so the form's own
 * close pops back to the list; a bare push leaves no marker and degrades that
 * close into a replace. QuizForm is absent on purpose — it is a top-level route
 * that the quiz list reaches with a plain row link.
 */
export const MODAL_FORM_ROUTES = new Set(['ProgramForm', 'AssignmentForm'])

/** Where a search hit opens; an unmapped doctype yields nothing and its row is dropped. */
export function routeForSearchHit(
	doctype: string,
	name: string,
	context: PaletteRouteContext = {}
): PaletteRoute | null {
	return getRecordRoute(doctype, name, context) as PaletteRoute | null
}
