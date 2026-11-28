import { MOBILE_BREAKPOINT } from '@/utils/composables'

const FLOW_HOST = 'flow-launcher'

/** reka turns the body's pointer events off while a modal layer is open. */
const isModalOpen = (): boolean => document.body.style.pointerEvents === 'none'

const isInFlow = (node: EventTarget | null): boolean =>
	node instanceof Node &&
	Boolean(document.querySelector(FLOW_HOST)?.contains(node))

/** Flow has already handled these by the time they reach its host. */
const keepFromPage = (event: Event) => {
	if (!isModalOpen()) return
	if (event instanceof KeyboardEvent && event.key !== 'Escape') return
	event.stopPropagation()
}

/**
 * In a window too narrow to dock, Flow's open panel covers the page, and with it
 * a dialog's right side. Marks <html> with the panel's width while it is open
 * and still leaves a page beside it, so dialogs make room as they do when Flow
 * docks. The panel is `inert` while closed and carries its width as `--width`.
 */
export function markOpenPanel(panel: HTMLElement): void {
	const width = parseFloat(panel.style.getPropertyValue('--width'))
	const open =
		!panel.inert && width > 0 && innerWidth - width >= MOBILE_BREAKPOINT
	const page = document.documentElement
	page.toggleAttribute('data-flow-open', open)
	if (open) page.style.setProperty('--flow-panel-width', `${width}px`)
	else page.style.removeProperty('--flow-panel-width')
}

const trackPanel = (host: Element) => {
	const panel = host.shadowRoot?.querySelector<HTMLElement>('.panel')
	if (!panel) return
	const mark = () => markOpenPanel(panel)
	mark()
	new MutationObserver(mark).observe(panel, {
		attributes: true,
		attributeFilter: ['inert', 'style'],
	})
	window.addEventListener('resize', mark)
}

const guardHost = (host: Element) => {
	for (const type of ['pointerdown', 'focusin', 'keydown'])
		host.addEventListener(type, keepFromPage)
	trackPanel(host)
}

/**
 * Lets Flow's docked panel be used while a modal is open. A modal dismisses
 * itself on a pointerdown, focus or Escape outside it, and its focus trap pulls
 * focus back, all from document listeners; Flow's own events stop at its host,
 * and focus leaving a dialog for Flow stops before the trap sees it.
 */
export function keepFlowUsableBesideDialogs(): void {
	window.addEventListener(
		'focusout',
		(event) => {
			if (isModalOpen() && isInFlow(event.relatedTarget))
				event.stopPropagation()
		},
		true
	)
	const host = document.querySelector(FLOW_HOST)
	if (host) return guardHost(host)
	const observer = new MutationObserver(() => {
		const added = document.querySelector(FLOW_HOST)
		if (!added) return
		observer.disconnect()
		guardHost(added)
	})
	observer.observe(document.body, { childList: true })
}
