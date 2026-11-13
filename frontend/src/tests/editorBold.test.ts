import { describe, it, expect, beforeEach } from 'vitest'

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string): string => text

const { Bold } = await import('@/utils/inline/Bold')

// EditorJS's built-in Bold calls `document.execCommand('bold')`. Inside a
// heading the text is already bold, so the browser reads the command as "on"
// and *un*-bolds instead: it writes `<span style="font-weight: normal">`, which
// the block sanitizer then drops. Bolding a heading was therefore impossible:
// the toolbar button and Ctrl+B both silently did nothing. The Range-based tool
// below wraps the selection in `<b>` regardless of the surrounding weight.
function selectInside(host: HTMLElement, start: number, end: number): Range {
	const range = document.createRange()
	range.setStart(host.firstChild as Node, start)
	range.setEnd(host.firstChild as Node, end)
	const selection = window.getSelection()
	selection?.removeAllRanges()
	selection?.addRange(range)
	return range
}

function makeApi() {
	return {
		styles: { inlineToolButtonActive: 'ce-inline-tool--active' },
		selection: {
			expandToTag: (node: HTMLElement): void => {
				const range = document.createRange()
				range.selectNodeContents(node)
				const selection = window.getSelection()
				selection?.removeAllRanges()
				selection?.addRange(range)
			},
			findParentTag: (tag: string): HTMLElement | null => {
				let node = window.getSelection()?.anchorNode ?? null
				while (node) {
					if (node.nodeType === 1 && (node as HTMLElement).tagName === tag) {
						return node as HTMLElement
					}
					node = node.parentNode
				}
				return null
			},
		},
	}
}

describe('Bold inline tool', () => {
	let host: HTMLElement

	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('wraps the selection in <b> inside a heading', () => {
		host = document.createElement('h2')
		host.textContent = 'Heading probe text'
		document.body.appendChild(host)

		const bold = new Bold({ api: makeApi() } as never)
		bold.surround(selectInside(host, 0, 7))

		expect(host.innerHTML).toBe('<b>Heading</b> probe text')
	})

	it('wraps the selection in <b> inside a paragraph', () => {
		host = document.createElement('div')
		host.textContent = 'Paragraph probe text'
		document.body.appendChild(host)

		const bold = new Bold({ api: makeApi() } as never)
		bold.surround(selectInside(host, 0, 9))

		expect(host.innerHTML).toBe('<b>Paragraph</b> probe text')
	})

	it('unwraps an already bold selection', () => {
		host = document.createElement('h2')
		host.innerHTML = '<b>Heading</b> probe text'
		document.body.appendChild(host)

		const bold = new Bold({ api: makeApi() } as never)
		const b = host.querySelector('b') as HTMLElement
		selectInside(b, 0, 7)
		bold.checkState()
		expect(bold.state).toBe(true)

		bold.surround(window.getSelection()!.getRangeAt(0))
		expect(host.querySelector('b')).toBeNull()
		expect(host.textContent).toBe('Heading probe text')
	})
})
