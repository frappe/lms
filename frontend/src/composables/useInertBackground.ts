import { onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

// `#app`, never `<body>`: the overlay Teleports to body, and so do every reka-ui
// portal (a combobox listbox defaults to `portalTo: 'body'`) and reka's own
// focus guards. All of those are SIBLINGS of the app root, not children, so
// inerting body would kill the popovers the overlay still needs. `#app` is also
// not `main#scrollContainer` — that would leave the skip link, which is the
// first focusable element in the document, and the tab bar reachable.
//
// Set imperatively rather than bound in a template. `inert` is not in Vue's
// `specialBooleanAttrs`, and its prop-vs-attribute fork ends in `key in el` —
// true in a browser, false in jsdom, where `:inert="false"` would render
// `inert="false"` and thus BE inert. FormShell's focus trap reads
// `closest('[inert]')`, so that would silently empty its tab stops under test.
//
// Ref-counted: a BottomSheet opened inside a FormShell wants the same thing, and
// a naive remove-on-close from the inner one would wake the background while the
// outer overlay is still open.
let depth = 0

const apply = (on: boolean): void => {
	depth = Math.max(0, depth + (on ? 1 : -1))
	document.getElementById('app')?.toggleAttribute('inert', depth > 0)
}

export function useInertBackground(active: Ref<boolean>): void {
	let held = false

	const set = (on: boolean): void => {
		if (on === held) return
		held = on
		apply(on)
	}

	watch(active, (on) => set(on), { immediate: true })
	onBeforeUnmount(() => set(false))
}
