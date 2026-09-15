import { onScopeDispose } from 'vue'
import {
	useRouter,
	type HistoryState,
	type RouteLocationRaw,
	type Router,
} from 'vue-router'

/**
 * Marker written into history.state when we open a form route ourselves.
 * Its absence means the user arrived by deep link, reload, or a hand-typed URL,
 * so there is no entry of ours to pop.
 */
const FORM_ENTRY = 'lmsFormEntry'

/**
 * The location openFormRoute is leaving. router.push() would unmount that
 * page, floating the form's Dialog over a blank app; App.vue keeps it rendered.
 */
const FORM_BACKGROUND = 'lmsFormBackground'

// Reads the state of the CURRENT history entry through the router rather than
// window.history: createMemoryHistory (used in tests) never touches
// window.history, and vue-router mirrors the web history's state here too.
const historyState = (router: Router): Record<string, unknown> =>
	(router.options.history.state as Record<string, unknown> | null) ?? {}

/**
 * The fullPath App.vue should render behind the current form route, or null
 * when nothing stamped one (a deep link, a reload, a hand-typed URL).
 */
export function formBackgroundPath(router: Router): string | null {
	const stored = historyState(router)[FORM_BACKGROUND]
	return typeof stored === 'string' && stored ? stored : null
}

/**
 * Merges the CURRENT entry's background stamp into an entry that overlays
 * the same page (settings, addressed by hash). Without it, a settings entry
 * pushed over a form route carries no stamp, so App.vue paints nothing
 * behind settings and the next openFormRoute would record settings itself
 * as the background. Written unconditionally, null included: replace()
 * merges state, so an omitted key would leak the old value.
 */
export function withFormBackground(
	router: Router,
	state: HistoryState = {}
): HistoryState {
	return { ...state, [FORM_BACKGROUND]: formBackgroundPath(router) }
}

// Normalizes `to` and stamps FORM_ENTRY without clobbering existing state.
// FORM_BACKGROUND is always written, null included: replace() MERGES state
// over the entry it replaces, so an omitted key would leak the form's
// background onto a destination that isn't a modal at all.
const withFormEntry = (
	to: RouteLocationRaw,
	value: boolean,
	background: string | null = null
): Exclude<RouteLocationRaw, string> & { state: Record<string, unknown> } => {
	const location = typeof to === 'string' ? { path: to } : to
	const priorState =
		'state' in location && location.state
			? (location.state as Record<string, unknown>)
			: {}
	return {
		...location,
		state: {
			...priorState,
			[FORM_ENTRY]: value,
			[FORM_BACKGROUND]: background,
		},
	}
}

export function openFormRoute(
	router: Router,
	to: RouteLocationRaw
): Promise<unknown> {
	const current = router.currentRoute.value
	// Carry an existing background forward: opening form B from form A must
	// still show the page A was opened over, not form A itself.
	const background = current.matched.length
		? formBackgroundPath(router) ?? current.fullPath
		: null
	return router.push(withFormEntry(to, true, background))
}

export function useFormRoute(parent: RouteLocationRaw): {
	close: () => void
	saveAndReplace: (to: RouteLocationRaw) => void
	openedByUs: boolean
} {
	const router = useRouter()
	// Read once, at setup. By close time this is still the same history entry.
	// Going through the router rather than window.history keeps it readable
	// under createMemoryHistory, which never touches window.history.
	const openedByUs = historyState(router)[FORM_ENTRY] === true

	// router.back()/replace() are async, and the component stays mounted until
	// the navigation actually flushes — so a second close() call inside that
	// window (double-tapping the mobile back chevron, or two Escape presses:
	// the desktop Dialog's :open="true" is a literal, not the controlled
	// isOpen the real Dialog tracks internally, so it stays visibly open
	// after the first Escape until the route pop renders) would call
	// router.back() again and pop a second entry. Guard with a flag cleared in
	// afterEach — mirrors feat/settings-url-routing's useSettingsHash.ts
	// `dropping`, cleared the same way because afterEach fires on aborted
	// navigations too, so a cancelled pop can't leave `closing` stuck true.
	let closing = false
	onScopeDispose(
		router.afterEach(() => {
			closing = false
		})
	)

	const close = (): void => {
		if (closing) return
		closing = true
		if (openedByUs) router.back()
		else router.replace(parent)
	}

	// saveAndReplace does NOT need the same guard. Unlike back(), replace() is
	// idempotent under a repeated identical call — two replaces to the same
	// destination land you there once, not twice as far, so there is no
	// compounding effect to guard against. Its only call site today is a
	// resource's onSuccess (fires once per submit) behind a Save button whose
	// :loading state already disables a second click — there is no
	// back-arrow/Escape-shaped path that can fire it twice the way close() has.
	//
	// Saving navigates onward by REPLACING, so the form entry is consumed and
	// Back reaches the list rather than a stale, empty form.
	const saveAndReplace = (to: RouteLocationRaw): void => {
		router.replace(withFormEntry(to, false))
	}

	return { close, saveAndReplace, openedByUs }
}
