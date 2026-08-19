// Tab containment for the two things in the app that claim `aria-modal="true"`:
// FormShell's mobile page and BottomSheet. aria-modal tells a screen reader the
// page behind is not there but does not stop Tab reaching it, so without this a
// keyboard user types into elements hidden behind a backdrop.
//
// Shared rather than copied: BottomSheet grew its own FOCUSABLE constant, which
// then drifted from this one and left it focusing an element that cannot hold
// focus.

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])'

// frappe-ui's FileUploader renders <input type="file" class="hidden"> — display
// none, but no `hidden` attribute — and ChapterForm, NewCourseForm, JobForm,
// ProfileEditForm and CourseImportForm all reach one. Filtering on the
// attribute alone left it in the cycle as a stop that cannot hold focus, which
// also made it `last` on any form ending in an uploader and so wrapped Tab off
// the wrong element.
//
// checkVisibility is what actually accounts for a display:none ancestor: the
// computed `display` of a descendant is its own value, not the ancestor's, so
// getComputedStyle cannot see that case. jsdom does not implement it, hence the
// fallback — which means the ancestor case is browser-only and untested here.
const isFocusable = (el: HTMLElement): boolean => {
	if (el.closest('[hidden]') || el.closest('[inert]')) return false
	if (typeof el.checkVisibility === 'function')
		return el.checkVisibility({ checkVisibilityCSS: true })
	const style = getComputedStyle(el)
	return style.display !== 'none' && style.visibility !== 'hidden'
}

export const focusStops = (root: HTMLElement): HTMLElement[] =>
	Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isFocusable)

// reka-ui — which frappe-ui's Combobox, Select, Dropdown and Dialog all build
// on, and which the LMS `Link` control reaches through Combobox — dismisses a
// layer from vueuse's onKeyStroke, whose default target is `window`. Bubbling
// reaches `document` before `window`, and reka never calls preventDefault, so
// `defaultPrevented` cannot tell us a popover is open this early: the layer
// element reka renders is the only signal available.
//
// This asks whether the FOCUSED element owns a layer, not whether any layer
// exists: HeaderButton wraps every mobile icon action in a Tooltip and reka
// opens a tooltip on keyboard focus, so a bare `[data-dismissable-layer]` query
// would swallow Escape whenever Save merely has focus. A tooltip trigger
// carries aria-describedby and never aria-expanded, so it fails this test.
// Both branches are load-bearing: a button-mode combobox moves focus into the
// portaled layer, while the input mode `Link` uses keeps focus on the input.
export const focusedElementOwnsLayer = (): boolean => {
	const active = document.activeElement as HTMLElement | null
	if (!active) return false
	if (active.closest('[data-dismissable-layer]')) return true
	if (active.getAttribute('aria-expanded') !== 'true') return false
	const controls = active.getAttribute('aria-controls')
	const owned = controls ? document.getElementById(controls) : null
	return !!owned?.closest('[data-dismissable-layer]')
}

/**
 * Wrap Tab at the edges of `root`. Call from a keydown listener.
 *
 * `root` itself is the mount-time focus holder in both callers (they carry
 * tabindex="-1" so a container with nothing focusable in it can still take
 * focus off the page behind), so a Shift+Tab from it wraps to the end rather
 * than escaping upwards.
 */
export const trapTab = (
	event: KeyboardEvent,
	root: HTMLElement | null
): void => {
	if (!root) return
	// The combobox listbox portals to <body>, so it is invisible to the stops
	// below. Without this the open popover's own input is `last`, and wrapping
	// focus to the top would tear the popover down through reka's focus-outside
	// dismissal instead of moving through its options.
	if (focusedElementOwnsLayer()) return
	const stops = focusStops(root)
	if (stops.length === 0) return
	const first = stops[0]
	const last = stops[stops.length - 1]
	if (
		event.shiftKey &&
		(document.activeElement === first || document.activeElement === root)
	) {
		event.preventDefault()
		last.focus()
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault()
		first.focus()
	}
}
