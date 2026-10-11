import { onScopeDispose } from 'vue'

/*
 * Stack dialogs by open order, and expose only the top one. Every frappe-ui
 * overlay is z-index:auto and teleported to <body> in *anchor* order, not
 * open order (Settings mounts at app start, so it is always first in <body>
 * however late it opens). `inert` also takes covered dialogs out of the
 * focus order and accessibility tree, so tabbing/screen readers stay on top.
 *
 * frappe-ui 1.0.0-beta.29 moved DialogContent out from inside DialogOverlay:
 * the overlay is now an empty `fixed inset-0` div, and the actual dialog
 * content lives in an adjacent teleported SIBLING,
 * `.dialog-scroll-container`. Both still land as direct <body> children in
 * that order (overlay, then its panel). Whatever z-index/inert/pointer-events
 * this file gives the overlay has to go on that sibling panel too, or the
 * overlay's own stacking context (it has an explicit z-index; the panel
 * doesn't) paints over its own dialog's content. reka also marks the overlay
 * `aria-hidden` under this shape (it's no longer an ancestor of the content),
 * which looks alarming but is unrelated to any of this.
 */
const OVERLAY = '.dialog-overlay'

/*
 * The beta.29 sibling holding a dialog's actual content. `null` under the
 * older nested shape (DialogContent inside DialogOverlay), which this file
 * still has to keep supporting for anything not yet on beta.29.
 */
const PANEL = '.dialog-scroll-container'

const panelOf = (overlay: HTMLElement): HTMLElement | null => {
	// nextElementSibling, not nextSibling: Teleport's own anchor comment
	// nodes sit between siblings and this skips them for free.
	const next = overlay.nextElementSibling
	return next instanceof HTMLElement && next.matches(PANEL) ? next : null
}

const contentOf = (overlay: HTMLElement): HTMLElement | null => {
	const nested = overlay.querySelector('[role="dialog"]')
	if (nested instanceof HTMLElement) return nested
	const inPanel = panelOf(overlay)?.querySelector('[role="dialog"]')
	return inPanel instanceof HTMLElement ? inPanel : null
}

/*
 * A menu, select or combobox opened from inside a dialog. reka-ui teleports
 * it into <body> with `z-index: auto`, so giving overlays an explicit
 * z-index would otherwise bury it under a `fixed inset-0` overlay. It never
 * enters the open-order stack; it sits one step above the top dialog.
 */
const POPPER = '[data-reka-popper-content-wrapper]'

/*
 * The popper's z-index can't simply be assigned: floating-ui rewrites the
 * whole inline style object on every reposition, clobbering it within a
 * frame. An author `!important` rule outranks inline styles and survives,
 * so the layer is carried on this attribute instead and a matching rule
 * supplies the z-index.
 */
const LAYER_ATTR = 'data-dialog-layer'

/*
 * reka sets `pointer-events: none` on every dismissable layer below the top
 * one, including a dialog holding an open menu, so a click meant for the
 * dialog lands on the overlay instead and dismisses it. Handing the content
 * back its pointer events fixes that, via the same `!important` lever as
 * the layer rule above (Vue rewrites this inline binding on every patch).
 */
const INTERACTIVE_ATTR = 'data-dialog-interactive'
const STYLE_ID = 'dialog-layering'

// One rule per layer, with a literal value: `var()` is the one part of this
// jsdom cannot resolve, and an untestable mechanism quietly stops working.
const ruled = new Set<number>()

const sheet = (): HTMLStyleElement => {
	const found = document.getElementById(STYLE_ID)
	if (found) return found as HTMLStyleElement
	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `[${INTERACTIVE_ATTR}]{pointer-events:auto !important}`
	document.head.appendChild(style)
	// A fresh document (a test's, or a reload) has none of the rules the
	// previous one accumulated.
	ruled.clear()
	return style
}

const ensureLayerRule = (layer: number) => {
	if (ruled.has(layer)) return
	ruled.add(layer)
	sheet().textContent += `[${LAYER_ATTR}="${layer}"]{z-index:${layer} !important}`
}

// Open order, which DOM order does not give us. A WeakMap so a closed dialog's
// entry goes away with its node. The counter only ever climbs, so it can't let
// a leftover overlay tie with one opened later.
const openedAt = new WeakMap<HTMLElement, number>()
let opened = 0

// Two z-index steps per dialog, so a popper has an odd number of its own to sit
// on between its dialog and the next one opened above it.
const layerOf = (order: number) => order * 2

const bodyChildren = () =>
	[...document.body.children].filter(
		(el): el is HTMLElement => el instanceof HTMLElement
	)

const overlays = () => bodyChildren().filter((el) => el.matches(OVERLAY))

const poppers = () => bodyChildren().filter((el) => el.matches(POPPER))

/*
 * A covered overlay blocking clicks despite `inert` has reproduced live in
 * CI (a fresh site, two other spec files' worth of concurrent load) but
 * never locally, under any load this composable's own vitest suite or a
 * throttled/network-shaped Playwright run could put on it — see
 * HANDOVER-lms-settings-dialog-bug.md. A bounded ring buffer beats a
 * screenshot: it captures the sequence of restack() calls (open count,
 * each overlay's data-state, popper count) leading up to the moment it
 * happens, next time it does. Cheap enough to leave on always.
 */
const DEBUG_RING_SIZE = 50
const debugLog = (open: HTMLElement[]) => {
	const w = window as unknown as { __dialogLayeringDebug?: unknown[] }
	const ring = (w.__dialogLayeringDebug ??= [])
	ring.push({
		t: Date.now(),
		openCount: open.length,
		openStates: open.map((o) => o.getAttribute('data-state')),
		panelsFound: open.map((o) => panelOf(o) !== null),
		popperCount: poppers().length,
	})
	if (ring.length > DEBUG_RING_SIZE) ring.shift()
}

const restack = () => {
	const open = overlays()
	debugLog(open)

	// Every popper's own open order is timestamped here regardless of whether
	// a dialog happens to be open right now. Without this, a popper that was
	// already on the page before the NEXT dialog opens (a nav/create menu
	// whose selection fired but whose node outlives the click) would only get
	// timestamped the first time restack sees it WITH a dialog present —
	// making it look, wrongly, like it opened alongside that dialog rather
	// than before it.
	for (const popper of poppers()) {
		if (!openedAt.has(popper)) openedAt.set(popper, ++opened)
	}

	// A popper with no dialog under it is back in the root stacking context and is
	// handed back its own `auto`.
	if (!open.length) {
		for (const popper of poppers()) {
			popper.removeAttribute(LAYER_ATTR)
			popper.style.zIndex = ''
		}
		return
	}

	for (const overlay of open) {
		if (!openedAt.has(overlay)) openedAt.set(overlay, ++opened)
	}

	// Layers come from the rank inside the open set, not the open number itself,
	// so a leftover overlay can't tie with a later dialog on document order.
	const ordered = [...open].sort(
		(a, b) => (openedAt.get(a) ?? 0) - (openedAt.get(b) ?? 0)
	)
	ordered.forEach((overlay, rank) => {
		// Later in DOM order than its overlay, so a beta.29 panel at the same
		// z-index already paints above it — no extra rank needed.
		const z = String(layerOf(rank + 1))
		overlay.style.zIndex = z
		const panel = panelOf(overlay)
		if (panel) panel.style.zIndex = z
	})

	// Only the newest dialog is interactive; everything under it is inert.
	// `inert` alone has been caught, live in CI only (see debugLog above),
	// still catching a click on a covered overlay it's already set on —
	// `pointer-events` is the one property whose job is exactly this, so it
	// goes on redundantly rather than trusting `inert`'s hit-testing side
	// effect to always have taken by the time a click lands.
	const top = ordered[ordered.length - 1]
	for (const overlay of open) {
		const covered = overlay !== top
		overlay.inert = covered
		overlay.style.pointerEvents = covered ? 'none' : 'auto'
		const panel = panelOf(overlay)
		if (!panel) continue
		panel.inert = covered
		// The top panel is left '' rather than 'auto': under reka it must keep
		// inheriting <body>'s pointer-events:none so a click in the panel's own
		// padding (outside the centered dialog box) falls through to the
		// overlay underneath and dismisses the dialog, instead of the padding
		// itself swallowing it.
		panel.style.pointerEvents = covered ? 'none' : ''
	}

	// An open menu turns the dialog holding it off along with everything else
	// below the top layer. Hand that one its pointer events back.
	const menuOpen = poppers().length > 0
	for (const overlay of open) {
		const content = contentOf(overlay)
		if (!content) continue
		if (menuOpen && overlay === top) content.setAttribute(INTERACTIVE_ATTR, '')
		else content.removeAttribute(INTERACTIVE_ATTR)
	}

	// Fixed when the popper first appears, exactly as a dialog's own layer is. A
	// popper belongs to the dialog it was opened from, so re-reading the current
	// top would keep lifting the menu over whichever dialog replaced it.
	//
	// Only a popper timestamped AFTER the current top dialog is raised above
	// it — one timestamped earlier predates that dialog (a stale menu whose
	// node outlives its own dismissal) and is left at its default `auto`
	// stacking, below every dialog layer, rather than lifted over one it
	// doesn't belong to.
	const ceiling = layerOf(ordered.length)
	const topOpenedAt = openedAt.get(top) ?? 0
	for (const popper of poppers()) {
		if (popper.hasAttribute(LAYER_ATTR)) continue
		if ((openedAt.get(popper) ?? 0) <= topOpenedAt) continue
		const layer = ceiling + 1
		ensureLayerRule(layer)
		popper.setAttribute(LAYER_ATTR, String(layer))
		// Belt and braces. The inline value is what holds until floating-ui's
		// next reposition rewrites the style object; the rule is what holds
		// after it.
		popper.style.zIndex = String(layer)
	}
}

// DialogContent stops `pointerdown` before reka's own listener can close the
// menu, so the dismissal is sent explicitly via Escape, which only ever
// closes the highest layer (the menu, never the dialog under it) — PROVIDED
// the menu actually still outranks the dialog. A dropdown/nav popper that
// "outlives the click" (its trigger's selection already fired, but its own
// leave transition hasn't removed the node yet) stays a body child for a
// beat after the dialog it's unrelated to opens above it. `restack` already
// freezes a popper's layer, one above the ceiling, the moment it first
// appears — so a popper opened BEFORE the current top dialog is frozen
// below it, and is no longer reka's real highest DismissableLayer. Sending
// Escape for one of those would not reach it (reka only dismisses the
// highest layer) and would instead close the dialog the user just opened.
const topOverlayZ = (): number => {
	const z = overlays().map((o) => Number(o.style.zIndex) || 0)
	return z.length ? Math.max(...z) : 0
}

const menuAbove = (): boolean => {
	// LAYER_ATTR, not style.zIndex: floating-ui rewrites a popper's inline
	// style on every reposition, so the attribute — which the CSS rule keys
	// off — is the value that actually survives between restacks.
	const ceiling = topOverlayZ()
	return poppers().some((p) => Number(p.getAttribute(LAYER_ATTR)) > ceiling)
}

const dismissMenu = (event: Event) => {
	const target = event.target
	if (!(target instanceof Element)) return
	if (!menuAbove()) return
	if (target.closest(POPPER)) return
	if (!target.closest(`[${INTERACTIVE_ATTR}]`)) return
	document.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
	)
}

export function useDialogLayering() {
	// Overlays are teleported straight into <body>, so its direct children are
	// the only place they appear — no subtree walk needed.
	sheet()
	const observer = new MutationObserver(restack)
	observer.observe(document.body, { childList: true })
	restack()
	// Capture, so it runs before DialogContent swallows the event.
	document.addEventListener('pointerdown', dismissMenu, true)
	onScopeDispose(() => {
		observer.disconnect()
		document.removeEventListener('pointerdown', dismissMenu, true)
	})
}
