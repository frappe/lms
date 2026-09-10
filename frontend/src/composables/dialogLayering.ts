import { onScopeDispose } from 'vue'

/*
 * Stack dialogs by open order, and expose only the top one. Every frappe-ui
 * overlay is z-index:auto and teleported to <body> in *anchor* order, not
 * open order (Settings mounts at app start, so it is always first in <body>
 * however late it opens). `inert` also takes covered dialogs out of the
 * focus order and accessibility tree, so tabbing/screen readers stay on top.
 */
const OVERLAY = '.dialog-overlay'

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
const STYLE_ID = 'dialog-layering'

// One rule per layer, with a literal value: `var()` is the one part of this
// jsdom cannot resolve, and an untestable mechanism quietly stops working.
const ruled = new Set<number>()

const sheet = (): HTMLStyleElement => {
	const found = document.getElementById(STYLE_ID)
	if (found) return found as HTMLStyleElement
	const style = document.createElement('style')
	style.id = STYLE_ID
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
// entry goes away with its node.
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

const restack = () => {
	const open = overlays()

	// Nothing left: start the next stack from 1 again rather than let the
	// counter climb for the life of the page. A popper with no dialog under it
	// is back in the root stacking context, where DOM order already puts it on
	// top, so it is handed back its own `auto`.
	if (!open.length) {
		opened = 0
		for (const popper of poppers()) {
			popper.removeAttribute(LAYER_ATTR)
			popper.style.zIndex = ''
		}
		return
	}

	for (const overlay of open) {
		if (!openedAt.has(overlay)) {
			openedAt.set(overlay, ++opened)
			overlay.style.zIndex = String(layerOf(opened))
		}
	}

	// Only the newest dialog is interactive; everything under it is inert.
	const top = open.reduce((a, b) =>
		(openedAt.get(a) ?? 0) > (openedAt.get(b) ?? 0) ? a : b
	)
	for (const overlay of open) overlay.inert = overlay !== top

	// Fixed when the popper first appears, exactly as a dialog's own layer is.
	// A popper belongs to the dialog it was opened from, so a dialog opened
	// after it is a new top layer and has to come out above it — re-reading the
	// current top here would keep lifting the menu over the dialog that
	// replaced it.
	const ceiling = layerOf(openedAt.get(top) ?? 0)
	for (const popper of poppers()) {
		if (openedAt.has(popper)) continue
		openedAt.set(popper, opened)
		const layer = ceiling + 1
		ensureLayerRule(layer)
		popper.setAttribute(LAYER_ATTR, String(layer))
		// Belt and braces. The inline value is what holds until floating-ui's
		// next reposition rewrites the style object; the rule is what holds
		// after it.
		popper.style.zIndex = String(layer)
	}
}

export function useDialogLayering() {
	// Overlays are teleported straight into <body>, so its direct children are
	// the only place they appear — no subtree walk needed.
	sheet()
	const observer = new MutationObserver(restack)
	observer.observe(document.body, { childList: true })
	restack()
	onScopeDispose(() => observer.disconnect())
}
