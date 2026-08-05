import { describe, it, expect, beforeEach } from 'vitest'
import type { API, InlineToolConstructorOptions } from '@editorjs/editorjs'
import { Underline } from '@/utils/inline/Underline'
import { Strikethrough } from '@/utils/inline/Strikethrough'
import { AlignLeft, AlignCenter } from '@/utils/inline/TextAlign'
import { Color } from '@/utils/inline/Color'

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string): string => text

// Minimal EditorJS API surface the inline tools use, operating on the real
// jsdom selection/DOM. Cast like the sibling BlockEditor test does.
function makeApi(root: HTMLElement): API {
	return {
		styles: {
			inlineToolButton: 'ce-inline-tool',
			inlineToolButtonActive: 'ce-inline-tool--active',
		},
		selection: {
			findParentTag(tagName: string): HTMLElement | null {
				const selection = window.getSelection()
				let node: Node | null =
					selection && selection.rangeCount > 0
						? selection.getRangeAt(0).commonAncestorContainer
						: null
				while (node && node !== root.parentNode) {
					if (
						node instanceof HTMLElement &&
						node.tagName === tagName.toUpperCase()
					) {
						return node
					}
					node = node.parentNode
				}
				return null
			},
			expandToTag(node: HTMLElement): void {
				const selection = window.getSelection()
				const range = document.createRange()
				range.selectNodeContents(node)
				selection?.removeAllRanges()
				selection?.addRange(range)
			},
		},
	} as unknown as API
}

function options(root: HTMLElement): InlineToolConstructorOptions {
	return { api: makeApi(root) } as unknown as InlineToolConstructorOptions
}

function selectWithin(textHost: HTMLElement, start: number, end: number): Range {
	const textNode = textHost.firstChild as Node
	const range = document.createRange()
	range.setStart(textNode, start)
	range.setEnd(textNode, end)
	const selection = window.getSelection() as Selection
	selection.removeAllRanges()
	selection.addRange(range)
	return range
}

describe('decoration inline tools', () => {
	let root: HTMLElement

	beforeEach(() => {
		document.body.innerHTML = '<div id="root"><div id="p">hello world</div></div>'
		root = document.getElementById('root') as HTMLElement
	})

	it('wraps the selection in <u> and unwraps on toggle', () => {
		const host = document.getElementById('p') as HTMLElement
		const tool = new Underline(options(root))
		tool.surround(selectWithin(host, 0, 5))
		expect(host.querySelector('u')?.textContent).toBe('hello')

		expect(tool.checkState()).toBe(true)
		tool.surround(window.getSelection()!.getRangeAt(0))
		expect(host.querySelector('u')).toBeNull()
	})

	it('reflects an existing wrapper in checkState and toggles the active class', () => {
		const host = document.getElementById('p') as HTMLElement
		const tool = new Underline(options(root))
		const button = tool.render()
		tool.surround(selectWithin(host, 0, 5))
		tool.checkState()
		expect(button.classList.contains('ce-inline-tool--active')).toBe(true)
	})

	it('wraps the selection in <s> for strikethrough', () => {
		const host = document.getElementById('p') as HTMLElement
		const tool = new Strikethrough(options(root))
		tool.surround(selectWithin(host, 0, 5))
		expect(host.querySelector('s')?.textContent).toBe('hello')
	})

	it('exposes a sanitize config that whitelists its tag', () => {
		expect(Underline.sanitize).toEqual({ u: true })
		expect(Strikethrough.sanitize).toEqual({ s: true })
	})
})

describe('text-align inline tool', () => {
	let root: HTMLElement

	beforeEach(() => {
		document.body.innerHTML = '<div id="root"><div id="p">hello world</div></div>'
		root = document.getElementById('root') as HTMLElement
	})

	it('wraps block content in <lms-align> and sets text-align', () => {
		const host = document.getElementById('p') as HTMLElement
		const tool = new AlignCenter(options(root))
		selectWithin(host, 0, 5)
		tool.surround()
		const wrapper = host.querySelector('lms-align') as HTMLElement
		expect(wrapper).not.toBeNull()
		expect(wrapper.style.textAlign).toBe('center')
		expect(wrapper.style.display).toBe('block')
	})

	it('checkState is true only for the matching alignment', () => {
		const host = document.getElementById('p') as HTMLElement
		const center = new AlignCenter(options(root))
		const left = new AlignLeft(options(root))
		selectWithin(host, 0, 5)
		center.surround()
		expect(center.checkState()).toBe(true)
		expect(left.checkState()).toBe(false)
	})

	it('whitelists the lms-align tag in sanitize', () => {
		expect(AlignLeft.sanitize).toEqual({ 'lms-align': true })
	})
})

describe('color inline tool', () => {
	let root: HTMLElement

	beforeEach(() => {
		document.body.innerHTML = '<div id="root"><div id="p">hello world</div></div>'
		root = document.getElementById('root') as HTMLElement
	})

	it('renders two native color inputs in its action panel', () => {
		const tool = new Color(options(root))
		const panel = tool.renderActions()
		const inputs = panel.querySelectorAll('input[type="color"]')
		expect(inputs.length).toBe(2)
	})

	it('writes the picked colors back onto the wrapper node', () => {
		const tool = new Color(options(root))
		const panel = tool.renderActions()
		const node = document.createElement('lms-inline-color')
		const exposed = tool as unknown as { showActions(n: HTMLElement): void }
		exposed.showActions(node)

		const [textInput, backgroundInput] = Array.from(
			panel.querySelectorAll('input[type="color"]')
		) as HTMLInputElement[]
		textInput.value = '#ff0000'
		textInput.dispatchEvent(new Event('input', { bubbles: true }))
		backgroundInput.value = '#00ff00'
		backgroundInput.dispatchEvent(new Event('input', { bubbles: true }))

		expect(node.style.color).not.toBe('')
		expect(node.style.backgroundColor).not.toBe('')
	})

	it('whitelists the lms-inline-color tag in sanitize', () => {
		expect(Color.sanitize).toEqual({ 'lms-inline-color': true })
	})
})
