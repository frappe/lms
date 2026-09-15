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
	isActive?: boolean
	/** Belongs to a query the user has already replaced; shown, not selectable. */
	isStale?: boolean
}

export interface PaletteGroup {
	title: string
	items: PaletteItem[]
	isStale?: boolean
}

/** What the palette knows about the visitor when it picks a route. */
export interface PaletteRouteContext {
	/**
	 * Mirrors Programs.vue's own `canCreateProgram()`. Its cards open the edit
	 * form for these users and do nothing at all for anyone else, so this is
	 * what decides whether a program hit is an edit or a read.
	 */
	canEditPrograms?: boolean
}

/**
 * Where a search hit opens. Every doctype but LMS Course used to fall through to
 * the batch route, so a job hit navigated to /batches/JOB-0001; an unmapped
 * doctype now yields nothing and its row is dropped instead.
 */
const ROUTE_BUILDERS: Record<
	string,
	(name: string, context: PaletteRouteContext) => PaletteRoute
> = {
	'LMS Course': (name) => ({
		name: 'CourseDetail',
		params: { courseName: name },
	}),
	'LMS Batch': (name) => ({
		name: 'BatchDetail',
		params: { batchName: name },
	}),
	'Job Opportunity': (name) => ({ name: 'JobDetail', params: { job: name } }),
	'LMS Quiz': (name) => ({ name: 'QuizForm', params: { quizID: name } }),
	'LMS Assignment': (name) => ({
		name: 'AssignmentForm',
		params: { assignmentID: name },
	}),
	// Programs.vue splits by role: a student gets the read-only detail page,
	// while a moderator or instructor gets a list whose cards open ProgramForm.
	// Sending everyone to ProgramDetail dropped an author on a page with no way
	// into the program they were looking for.
	'LMS Program': (name, context) =>
		context.canEditPrograms
			? { name: 'ProgramForm', params: { programName: name } }
			: { name: 'ProgramDetail', params: { programName: name } },
}

/**
 * Routes that render as a modal over their list page. Both pages open them
 * through `openFormRoute`, which stamps the history entry so the form's own
 * close pops back to the list; a bare push leaves no marker and degrades that
 * close into a replace. QuizForm is absent on purpose — it is a top-level route
 * that the quiz list reaches with a plain row link.
 */
export const MODAL_FORM_ROUTES = new Set(['ProgramForm', 'AssignmentForm'])

export function routeForSearchHit(
	doctype: string,
	name: string,
	context: PaletteRouteContext = {}
): PaletteRoute | null {
	return ROUTE_BUILDERS[doctype]?.(name, context) ?? null
}
