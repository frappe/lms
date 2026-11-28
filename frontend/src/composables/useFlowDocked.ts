import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

const docked = ref<boolean>(false)
let watching = false

/**
 * Flow docks its panel by setting `--flow-dock-width` on <html>, which drives a
 * right margin; the window keeps its width. The margin animates in, so it reads
 * 0 when the attribute changes: the variable is the signal, the margin a fallback.
 */
function readDocked(): void {
	const style = getComputedStyle(document.documentElement)
	const dockWidth = parseFloat(style.getPropertyValue('--flow-dock-width'))
	docked.value = dockWidth > 0 || parseFloat(style.marginRight) > 0
}

function startWatching(): void {
	if (watching) return
	watching = true
	readDocked()
	new MutationObserver(readDocked).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['style', 'class'],
	})
	window.addEventListener('resize', readDocked)
	document.documentElement.addEventListener('transitionend', readDocked)
}

/** Whether Flow's panel is docked beside the app, shared by every caller. */
export function useFlowDocked(): Readonly<Ref<boolean>> {
	startWatching()
	return readonly(docked)
}
