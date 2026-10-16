import { describe, it, expect, beforeEach } from 'vitest'
import type { API, InlineToolConstructorOptions } from '@editorjs/editorjs'
import { Underline } from '@/utils/inline/Underline'
import { Strikethrough } from '@/utils/inline/Strikethrough'
import { AlignLeft, AlignCenter, AlignRight } from '@/utils/inline/TextAlign'

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
			// Mirrors EditorJS's Selection.findParentTag(tagName, className): when a
			// class is given the tag alone is not a match. A mock that ignores the
			// class would pass a tool that cannot tell its own wrapper from any
			// other span.
			findParentTag(tagName: string, className?: string): HTMLElement | null {
				const selection = window.getSelection()
				let node: Node | null =
					selection && selection.rangeCount > 0
						? selection.getRangeAt(0).commonAncestorContainer
						: null
				while (node && node !== root.parentNode) {
					if (
						node instanceof HTMLElement &&
						node.tagName === tagName.toUpperCase() &&
						(!className || node.classList.contains(className))
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

/** Select an offset span inside a host's first text node. */
function selectWithin(
	textHost: HTMLElement,
	start: number,
	end: number
): Range {
	const textNode = textHost.firstChild as Node
	return selectAcross(textNode, start, textNode, end)
}

describe('decoration inline tools', () => {
	let root: HTMLElement

	beforeEach(() => {
		document.body.innerHTML =
			'<div id="root"><div id="p">hello world</div></div>'
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

function selectAcross(
	startNode: Node,
	startOffset: number,
	endNode: Node,
	endOffset: number
): Range {
	const range = document.createRange()
	range.setStart(startNode, startOffset)
	range.setEnd(endNode, endOffset)
	const selection = window.getSelection() as Selection
	selection.removeAllRanges()
	selection.addRange(range)
	return range
}

// The original port honoured the user's Range when wrapping but not when
// unwrapping, and appended the extracted fragment whole. Everything here failed
// before BaseInline became range-driven on both halves.
describe('inline tools honour the selected range', () => {
	let root: HTMLElement

	beforeEach(() => {
		document.body.innerHTML = '<div id="root"></div>'
		root = document.getElementById('root') as HTMLElement
	})

	// Every character that ended up inside a <u>, in document order.
	const underlinedText = (host: HTMLElement): string =>
		Array.from(host.querySelectorAll('u'))
			.map((u): string => u.textContent ?? '')
			.join('')

	// Three wrappers threw WrongDocumentError out of compareBoundaryPoints, after
	// the DOM had already been partly mutated. Two clicks from any paragraph that
	// already carries formatting.
	it('unwraps a selection spanning three wrappers without throwing', () => {
		root.innerHTML =
			'<div id="p" contenteditable="true">The <u>quick</u> brown <u>fox</u></div>'
		const p = document.getElementById('p') as HTMLElement
		const tool = new Underline(options(root))
		const selectAll = (): Range => selectAcross(p, 0, p, p.childNodes.length)

		selectAll()
		tool.checkState()
		tool.surround(window.getSelection()!.getRangeAt(0))
		// wrap() merges, so the run is one element rather than four siblings.
		expect(p.querySelectorAll('u')).toHaveLength(1)
		expect(underlinedText(p)).toBe('The quick brown fox')

		selectAll()
		expect(tool.checkState()).toBe(true)
		expect(() => {
			tool.surround(window.getSelection()!.getRangeAt(0))
		}).not.toThrow()
		expect(p.querySelector('u')).toBeNull()
		expect(p.textContent).toBe('The quick brown fox')
	})

	// A single extractContents() over a multi-block selection put the <li>
	// elements inside the <u>; NestedList.save() drops those items, so the text
	// disappeared at the next save.
	it('does not pull block elements into an inline tag', () => {
		root.innerHTML =
			'<ul>' +
			'<li><div class="c" contenteditable="true">one</div></li>' +
			'<li><div class="c" contenteditable="true">two</div></li>' +
			'</ul>'
		const cells = root.querySelectorAll('.c')
		const tool = new Underline(options(root))
		selectAcross(cells[0].firstChild as Text, 0, cells[1].firstChild as Text, 3)
		tool.surround(window.getSelection()!.getRangeAt(0))
		expect(root.querySelectorAll('u li')).toHaveLength(0)
		expect(root.querySelectorAll('li')).toHaveLength(2)
		expect(cells[0].textContent).toBe('one')
		expect(cells[1].textContent).toBe('two')
		expect(cells[0].querySelector('u')).not.toBeNull()
		expect(cells[1].querySelector('u')).not.toBeNull()
	})
})

describe('text-align inline tool', () => {
	let root: HTMLElement

	beforeEach(() => {
		// EditorJS gives every block's editable root contenteditable="true"; the
		// tool keys off that, so the fixture has to carry it.
		document.body.innerHTML =
			'<div id="root">' +
			'<div id="p" contenteditable="true">hello world</div>' +
			'<h2 id="h" contenteditable="true">a heading</h2>' +
			'<div id="rich" contenteditable="true">plain <b>bold</b></div>' +
			'</div>'
		root = document.getElementById('root') as HTMLElement
	})

	it('wraps block content in a span the sanitizers keep', () => {
		const host = document.getElementById('p') as HTMLElement
		const tool = new AlignCenter(options(root))
		selectWithin(host, 0, 5)
		tool.surround()
		const wrapper = host.querySelector('span.lms-align') as HTMLElement
		expect(wrapper).not.toBeNull()
		expect(wrapper.style.textAlign).toBe('center')
		expect(wrapper.style.display).toBe('block')
		expect(wrapper.textContent).toBe('hello world')
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

	// A custom element cannot survive: nh3 server-side and DOMPurify on the read
	// path both allowlist by tag name and unwrap anything they do not know.
	it('sanitizes as a span keeping class and style', () => {
		expect(AlignLeft.sanitize).toEqual({
			span: { class: true, style: true },
		})
	})
})
