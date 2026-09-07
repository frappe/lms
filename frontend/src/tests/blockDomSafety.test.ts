import { describe, expect, it, vi } from 'vitest'
import { blockNotice, embedFrame } from '../utils/blockDom'
import { decodeEntities, htmlToText } from '../utils/inertHtml'

// The EditorJS blocks under src/utils build their DOM outside Vue, so every one
// of them used to interpolate an author-supplied id, title or file URL into an
// innerHTML template. These cover the replacements: the value is data, and a URL
// clears the same allowlist a bound :src does.

describe('embedFrame', () => {
	it('sets the src and the attributes it is given', () => {
		const frame = embedFrame('/lms/assignment-submission/A/new', {
			class: 'w-full',
			height: '500px',
		})
		expect(frame?.getAttribute('src')).toBe('/lms/assignment-submission/A/new')
		expect(frame?.getAttribute('class')).toBe('w-full')
		expect(frame?.getAttribute('height')).toBe('500px')
	})

	// No frame at all, rather than one with an empty src: src="" resolves to the
	// current page, so the block would render the whole SPA inside itself.
	it('returns nothing for a URL the allowlist rejects', () => {
		expect(embedFrame('javascript:alert(1)', {})).toBeUndefined()
		expect(embedFrame('/\\evil.test/p', {})).toBeUndefined()
		expect(embedFrame(undefined, {})).toBeUndefined()
	})

	// The old sink was `src="${path}"`, so a quote in the value opened an
	// attribute of the author's choosing.
	it('cannot be broken out of by a quote in the URL', () => {
		const frame = embedFrame('/files/a" onload="alert(1)', {})
		expect(frame?.getAttribute('onload')).toBeNull()
		expect(frame?.getAttributeNames()).toEqual(['src'])
		// The quote is escaped in the serialization, so it stays inside the value.
		expect(frame?.outerHTML).toContain('&quot; onload=&quot;')
	})
})

describe('blockNotice', () => {
	it('renders a title as text, not markup', () => {
		const card = blockNotice('Assignment: <img src=x onerror="alert(1)">')
		expect(card.querySelector('img')).toBeNull()
		expect(card.textContent).toBe('Assignment: <img src=x onerror="alert(1)">')
	})
})

describe('entity decoding is inert', () => {
	it('decodes entities and keeps raw tags as text', () => {
		expect(decodeEntities('&lt;p&gt;hi&lt;/p&gt;')).toBe('<p>hi</p>')
		expect(decodeEntities('&amp;amp;')).toBe('&amp;')
		expect(decodeEntities(null)).toBe('')
	})

	// The mechanism is the assertion: a textarea created in the live document
	// parses `</textarea><img src=x onerror=…>` into a node that still loads and
	// still fires, before any sanitizer sees the value.
	it('never parses input into a live-document node', () => {
		const create = vi.spyOn(document, 'createElement')
		decodeEntities('</textarea><img src=x onerror="alert(1)">')
		htmlToText('<img src=x onerror="alert(1)">')
		expect(create).not.toHaveBeenCalled()
		expect(document.querySelector('img')).toBeNull()
		create.mockRestore()
	})

	it('htmlToText still reads the text out of markup', () => {
		expect(htmlToText('<p>one <b>two</b></p>')).toBe('one two')
		expect(htmlToText('')).toBe('')
	})
})
