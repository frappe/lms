/**
 * Shared mount/query helpers for the CommandPalette test suites.
 *
 * The palette is built on `frappe-ui/experimental`'s real Dialog + Listbox, not
 * a stub, so it teleports into `document.body` — every query here runs against
 * the document rather than the mounted wrapper. jsdom has no layout, so reka's
 * scroll-the-highlight-into-view call needs a no-op stub.
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import CommandPalette from '@/components/CommandPalette/CommandPalette.vue'

if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = () => {}
}

let current: VueWrapper<any> | null = null

/** Reka defers mounting its teleported content by a few ticks of its own. */
export async function flush() {
	await nextTick()
	await nextTick()
	await nextTick()
}

export async function mountPalette(props: Record<string, unknown> = {}) {
	current?.unmount()
	document.body.innerHTML = ''
	current = mount(CommandPalette, {
		attachTo: document.body,
		props: { modelValue: true, ...props },
		global: { mocks: { __: (globalThis as any).__ ?? ((t: string) => t) } },
	})
	await flush()
	return current
}

export function unmountPalette() {
	current?.unmount()
	current = null
	document.body.innerHTML = ''
}

export function paletteInput(): HTMLInputElement {
	return document.body.querySelector(
		'[data-slot="command-palette-input"] input'
	) as HTMLInputElement
}

export function paletteResults(): HTMLElement {
	return document.body.querySelector(
		'[data-slot="command-palette-list"]'
	) as HTMLElement
}

/** Types `text` into the search field and lets a mocked (synchronous) debounce settle. */
export async function type(text: string) {
	const el = paletteInput()
	el.value = text
	el.dispatchEvent(new Event('input', { bubbles: true }))
	await flush()
}

export async function keydown(target: HTMLElement, key: string) {
	target.dispatchEvent(
		new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
	)
	await flush()
}

/** Every rendered `CommandPaletteItem`'s bound value, flattened across groups. */
export function paletteItemValues(): any[] {
	return current!
		.findAllComponents({ name: 'CommandPaletteItem' })
		.map((item) => item.props('value'))
}

/**
 * Clicks the rendered row whose value matches `predicate`.
 *
 * `CommandPaletteItem`'s root goes through reka's `as-child`/`CollectionItem`
 * wrapping, which leaves the component wrapper's own `.element` resolving to
 * an ancestor rather than the item's own node — so the click has to go through
 * the real DOM, matched by position against the same component list `value`
 * was read from.
 */
export async function clickItem(predicate: (value: any) => boolean) {
	const components = current!.findAllComponents({ name: 'CommandPaletteItem' })
	const index = components.findIndex((component) =>
		predicate(component.props('value'))
	)
	if (index === -1) throw new Error('No matching CommandPaletteItem found')
	const el = document.body.querySelectorAll(
		'[data-slot="command-palette-item"]'
	)[index] as HTMLElement | undefined
	if (!el) throw new Error('No matching CommandPaletteItem element found')
	el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
	await flush()
}

export function paletteText(): string {
	return document.body.textContent ?? ''
}
