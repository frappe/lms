import { onScopeDispose } from 'vue'
import { useRouter, type RouteLocationRaw, type Router } from 'vue-router'

/**
 * Marker written into history.state when we open a form route ourselves.
 * Its absence means the user arrived by deep link, reload, or a hand-typed URL,
 * so there is no entry of ours to pop.
 */
const FORM_ENTRY = 'lmsFormEntry'

// Normalizes `to` and stamps FORM_ENTRY, preserving whatever state the caller
// already set rather than clobbering it — both openFormRoute (true) and
// saveAndReplace (false) go through this.
const withFormEntry = (
	to: RouteLocationRaw,
	value: boolean
): Exclude<RouteLocationRaw, string> & { state: Record<string, unknown> } => {
	const location = typeof to === 'string' ? { path: to } : to
	const priorState =
		'state' in location && location.state
			? (location.state as Record<string, unknown>)
			: {}
	return { ...location, state: { ...priorState, [FORM_ENTRY]: value } }
}

export function openFormRoute(
	router: Router,
	to: RouteLocationRaw
): Promise<unknown> {
	return router.push(withFormEntry(to, true))
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
	const openedByUs =
		(router.options.history.state as Record<string, unknown> | null)?.[
			FORM_ENTRY
		] === true

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
