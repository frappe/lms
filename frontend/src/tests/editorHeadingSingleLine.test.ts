import { describe, it, expect, vi } from 'vitest'
import { Heading } from '@/utils/heading'
import Header from '@editorjs/header'
import type { HeaderData } from '@editorjs/header'

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string): string => text
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

// '@/utils' pulls frappe-ui's resource plugin, which doesn't resolve under
// vitest; only the tool-config shape matters here.
vi.mock('frappe-ui', () => ({ call: () => {}, toast: {} }))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

const { getEditorTools } = await import('@/utils')

function newHeading(data: Partial<HeaderData>): Heading {
	return new Heading({
		data,
		api: {
			i18n: { t: (text: string): string => text },
			styles: { block: 'cdx-block' },
		},
		config: {},
		readOnly: false,
	})
}

function press(
	element: HTMLElement,
	key: string,
	{ shiftKey = false } = {}
): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		key,
		shiftKey,
		bubbles: true,
		cancelable: true,
	})
	element.dispatchEvent(event)
	return event
}

describe('Heading: single line', () => {
	it('refuses the Shift+Enter line break', () => {
		const element = newHeading({ text: 'Title', level: 2 }).render()
		expect(press(element, 'Enter', { shiftKey: true }).defaultPrevented).toBe(
			true
		)
	})

	it('leaves plain Enter to EditorJS so it still splits the block', () => {
		const element = newHeading({ text: 'Title', level: 2 }).render()
		expect(press(element, 'Enter').defaultPrevented).toBe(false)
	})

	it('keeps refusing breaks after the heading level changes', () => {
		const heading = newHeading({ text: 'Title', level: 2 })
		// The level tunes replace the element, so the guard has to come with it.
		const wrapper = document.createElement('div')
		wrapper.appendChild(heading.render())
		heading.setLevel(4)

		const element = heading.render()
		expect(element.tagName).toBe('H4')
		expect(press(element, 'Enter', { shiftKey: true }).defaultPrevented).toBe(
			true
		)
	})

	it.each(['First<br>Second', 'First<br/>Second', 'First<BR />Second'])(
		'flattens a line break already stored in the heading (%s)',
		(text) => {
			const element = newHeading({ text, level: 2 }).render()

			expect(element.querySelector('br')).toBeNull()
			expect(element.textContent).toBe('First Second')
		}
	)

	it('renders an empty heading without a text field', () => {
		const element = newHeading({}).render()

		expect(element.textContent).toBe('')
		expect(press(element, 'Enter', { shiftKey: true }).defaultPrevented).toBe(
			true
		)
	})

	it('flattens line breaks carried in by a merged paragraph', () => {
		const heading = newHeading({ text: 'Title', level: 2 })
		heading.merge({ text: ' one<br>two' })
		expect(heading.render().querySelector('br')).toBeNull()
		expect(heading.render().textContent).toBe('Title one two')
	})

	it('is the class the editor registers for the header block', () => {
		const tools = getEditorTools() as Record<string, { class?: unknown }>

		expect(tools.header.class).toBe(Heading)
	})
})

// The behaviour this replaced, kept as a characterisation test: the stock tool
// lets the break through, and the sanitizer then drops it on save, which is
// how a heading could look like two lines and reload as one glued word.
describe('stock @editorjs/header', () => {
	it('lets Shift+Enter through and keeps a stored break', () => {
		const stock = new Header({
			data: { text: 'First<br>Second', level: 2 },
			api: {
				i18n: { t: (text: string): string => text },
				styles: { block: 'cdx-block' },
			},
			config: {},
			readOnly: false,
		})
		const element = stock.render()

		expect(press(element, 'Enter', { shiftKey: true }).defaultPrevented).toBe(
			false
		)
		expect(element.querySelector('br')).not.toBeNull()
	})
})
