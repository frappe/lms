import { CodeXml } from 'lucide-vue-next'
import { createApp, h } from 'vue'
import { escapeHTML } from '@/utils/format'

// Language-class hints on pasted code (hljs/Prism/SyntaxHighlighter). Anchored to
// a class-token boundary so 'language-' matches only as its own class.
const CODE_LANGUAGE_PATTERNS = [
	/(?:^|\s)(?:language|lang)-([\w+#-]+)/i,
	/(?:^|\s)brush:\s*([\w+#-]+)/i,
]

// Inline tags we keep when pasting rich HTML, normalized to the same tags the
// editor's own inline tools emit. Everything else (span/font/div wrappers,
// colors, styles) is dropped while its text is preserved. The stored content is
// still run through DOMPurify (render) and Frappe sanitize_html (save), so this
// map is a whitelist, not the only line of defense.
const INLINE_TAG_MAP = {
	B: 'b',
	STRONG: 'b',
	I: 'i',
	EM: 'i',
	U: 'u',
	S: 's',
	STRIKE: 's',
	DEL: 's',
	MARK: 'mark',
	CODE: 'code',
	SUP: 'sup',
	SUB: 'sub',
	A: 'a',
}

// Inline elements that, when they appear at the top level, should become a
// single paragraph rather than being recursed into as a container.
const INLINE_TAGS = new Set([
	...Object.keys(INLINE_TAG_MAP),
	'SPAN',
	'FONT',
	'SMALL',
	'ABBR',
	'LABEL',
	'BR',
])

export class Markdown {
	constructor({ data, api, readOnly, config }) {
		this.api = api
		this.data = data || {}
		this.config = config || {}
		this.readOnly = readOnly
		this.text = data.text || ''
		this.placeholder = __("Type '/' for commands or select text to format")
	}

	static get isReadOnlySupported() {
		return true
	}

	static get conversionConfig() {
		return {
			export: 'text',
			import: 'text',
		}
	}

	static get toolbox() {
		const app = createApp({
			render: () =>
				h(CodeXml, { size: 18, strokeWidth: 1.5, color: 'black' }),
		})

		const div = document.createElement('div')
		app.mount(div)
		return { title: '', icon: div.innerHTML }
	}

	static get pasteConfig() {
		return {
			tags: ['P'],
		}
	}

	render() {
		this.wrapper = document.createElement('div')
		this.wrapper.classList.add('cdx-block', 'ce-paragraph')
		this.wrapper.contentEditable = !this.readOnly
		this.wrapper.dataset.placeholder = this.placeholder
		this.wrapper.innerHTML = this.text

		if (!this.readOnly) {
			this.wrapper.addEventListener('focus', () =>
				this._togglePlaceholder()
			)
			this.wrapper.addEventListener('blur', () =>
				this._togglePlaceholder()
			)
			this.wrapper.addEventListener('keydown', (e) => this._onKeyDown(e))
			this.wrapper.addEventListener(
				'paste',
				(e) => this._onNativePaste(e),
				true
			)
		}

		return this.wrapper
	}

	_onNativePaste(event) {
		const clipboardData = event.clipboardData || window.clipboardData
		if (!clipboardData) return

		// Internal EditorJS block copy/paste carries its own payload — let
		// EditorJS handle it so cross-block moves keep working.
		if (clipboardData.getData('application/x-editor-js')) return

		const pastedText = clipboardData.getData('text/plain')
		const pastedHTML = clipboardData.getData('text/html')
		const hasHTMLTags = (s) =>
			/<(pre|h[1-6]|ul|ol|table|img|blockquote|figure|p|div|section|article)[\s>]/i.test(
				s
			)

		const html =
			(pastedText && hasHTMLTags(pastedText) && pastedText) ||
			(pastedHTML && hasHTMLTags(pastedHTML) && pastedHTML)

		if (html) {
			event.preventDefault()
			event.stopPropagation()
			event.stopImmediatePropagation()

			this._insertBlocks(this._parsePastedHTMLToBlocks(html))
			return
		}

		if (pastedText && this._looksLikeMarkdown(pastedText)) {
			event.preventDefault()
			event.stopPropagation()
			event.stopImmediatePropagation()

			this._insertMarkdownAsBlocks(pastedText)
		}
	}

	_looksLikeMarkdown(text) {
		const markdownPatterns = [
			/^#{1,6}\s+/m,
			/^[\-\*]\s+/m,
			/^\d+\.\s+/m,
			/```[\s\S]*```/,
		]

		return markdownPatterns.some((pattern) => pattern.test(text))
	}

	async _insertBlocks(blocks) {
		if (blocks.length === 0) return

		const currentIndex = this.api.blocks.getCurrentBlockIndex()

		for (let i = 0; i < blocks.length; i++) {
			try {
				await this.api.blocks.insert(
					blocks[i].type,
					blocks[i].data,
					{},
					currentIndex + i,
					false
				)
			} catch (error) {
				console.error('Failed to insert block:', blocks[i], error)
			}
		}

		try {
			await this.api.blocks.delete(currentIndex + blocks.length)
		} catch (e) {
			// original block may already be gone
		}

		setTimeout(() => {
			this.api.caret.setToBlock(currentIndex, 'end')
		}, 100)
	}

	_insertMarkdownAsBlocks(markdown) {
		this._insertBlocks(this._parseMarkdownToBlocks(markdown))
	}

	_parseMarkdownToBlocks(markdown) {
		const lines = markdown.split('\n')
		const blocks = []
		let i = 0

		while (i < lines.length) {
			const line = lines[i]

			if (line.trim() === '') {
				i++
				continue
			}

			if (line.trim().startsWith('```')) {
				const codeBlock = this._parseCodeBlock(lines, i)
				blocks.push(codeBlock.block)
				i = codeBlock.nextIndex
				continue
			}

			if (/^#{1,6}\s+/.test(line)) {
				blocks.push(this._parseHeading(line))
				i++
				continue
			}

			if (/^[\s]*[-*+]\s+/.test(line)) {
				const listBlock = this._parseUnorderedList(lines, i)
				blocks.push(listBlock.block)
				i = listBlock.nextIndex
				continue
			}

			if (/^[\s]*(\d+)\.\s+/.test(line)) {
				const listBlock = this._parseOrderedList(lines, i)
				blocks.push(listBlock.block)
				i = listBlock.nextIndex
				continue
			}

			blocks.push({
				type: 'paragraph',
				data: { text: this._parseInlineMarkdown(line) },
			})
			i++
		}

		return blocks
	}

	_parseHeading(line) {
		const match = line.match(/^(#{1,6})\s+(.*)$/)
		const level = match[1].length
		const text = match[2]

		return {
			type: 'header',
			data: {
				text: this._parseInlineMarkdown(text),
				level: level,
			},
		}
	}

	_parseUnorderedList(lines, startIndex) {
		const items = []
		let i = startIndex

		while (i < lines.length) {
			const line = lines[i]

			if (/^[\s]*[-*+]\s+/.test(line)) {
				const text = line.replace(/^[\s]*[-*+]\s+/, '')
				items.push({
					content: this._parseInlineMarkdown(text),
					items: [],
				})
				i++
			} else if (line.trim() === '') {
				i++
				if (i < lines.length && /^[\s]*[-*+]\s+/.test(lines[i])) {
					continue
				} else {
					break
				}
			} else {
				break
			}
		}

		return {
			block: {
				type: 'list',
				data: {
					style: 'unordered',
					items: items,
				},
			},
			nextIndex: i,
		}
	}

	_parseOrderedList(lines, startIndex) {
		const items = []
		let i = startIndex

		while (i < lines.length) {
			const line = lines[i]

			const match = line.match(/^[\s]*(\d+)\.\s+(.*)$/)

			if (match) {
				const number = match[1]
				const text = match[2]

				if (number === '1') {
					if (items.length > 0) {
						break
					}
				}

				items.push({
					content: this._parseInlineMarkdown(text),
					items: [],
				})
				i++
			} else if (line.trim() === '') {
				i++
				if (i < lines.length && /^[\s]*(\d+)\.\s+/.test(lines[i])) {
					continue
				} else {
					break
				}
			} else {
				break
			}
		}

		return {
			block: {
				type: 'list',
				data: {
					style: 'ordered',
					items: items,
				},
			},
			nextIndex: i,
		}
	}

	_parseCodeBlock(lines, startIndex) {
		let i = startIndex + 1
		const codeLines = []
		let language = lines[startIndex].trim().substring(3).trim()

		while (i < lines.length) {
			if (lines[i].trim().startsWith('```')) {
				i++
				break
			}
			codeLines.push(lines[i])
			i++
		}

		return {
			block: {
				type: 'codeBox',
				data: {
					code: escapeHTML(codeLines.join('\n')),
					language: language || 'plaintext',
				},
			},
			nextIndex: i,
		}
	}

	_parseInlineMarkdown(text) {
		if (!text) return ''

		let html = escapeHTML(text)

		html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

		html = html.replace(/\*\*([^\*\n]+?)\*\*/g, '<b>$1</b>')
		html = html.replace(/__([^_\n]+?)__/g, '<b>$1</b>')

		html = html.replace(/\*([^\*\n]+?)\*/g, '<i>$1</i>')
		html = html.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '<i>$1</i>')

		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

		return html
	}

	_togglePlaceholder() {
		const blocks = document.querySelectorAll(
			'.cdx-block.ce-paragraph[data-placeholder]'
		)
		blocks.forEach((block) => {
			if (block !== this.wrapper) delete block.dataset.placeholder
		})

		if (this.wrapper.innerHTML.trim() === '') {
			this.wrapper.dataset.placeholder = this.placeholder
		} else {
			delete this.wrapper.dataset.placeholder
		}
	}

	_onKeyDown(event) {
		const text = this.wrapper.textContent

		if (event.key === ' ' && /^#{1,6}$/.test(text)) {
			event.preventDefault()
			const level = text.length
			this.wrapper.textContent = ''
			this._convertBlock('header', { level })
		} else if (event.key === ' ' && text === '-') {
			event.preventDefault()
			this.wrapper.textContent = ''
			this._convertBlock('list', {
				style: 'unordered',
				items: [{ content: '' }],
			})
		} else if (event.key === ' ' && /^1\.$/.test(text)) {
			event.preventDefault()
			this.wrapper.textContent = ''
			this._convertBlock('list', {
				style: 'ordered',
				items: [{ content: '' }],
			})
		} else if (this._isEmbed(text) && event.key === 'Enter') {
			event.preventDefault()
			this.wrapper.textContent = ''
			this._convertBlock('embed', { source: text })
		} else if (event.key === 'Enter') {
			setTimeout(() => this._checkMarkdownAfterEnter(), 0)
		}
	}

	_checkMarkdownAfterEnter() {
		const text = this.wrapper.textContent.trim()

		if (this._isImage(text)) {
			this._convertBlock('image', {
				file: { url: this._extractImage(text).url },
			})
		}
	}

	async _convertBlock(type, data) {
		const currentIndex = this.api.blocks.getCurrentBlockIndex()
		const currentBlock = this.api.blocks.getBlockByIndex(currentIndex)

		if (!currentBlock) return

		await this.api.blocks.convert(currentBlock.id, type, data)

		setTimeout(() => {
			const newIndex = this.api.blocks.getCurrentBlockIndex()
			const newBlock = this.api.blocks.getBlockByIndex(newIndex)

			if (newBlock && newBlock.holder) {
				const holder = newBlock.holder.querySelector(
					'[contenteditable="true"]'
				)
				if (holder) {
					holder.focus()
					// Place caret at end
					const range = document.createRange()
					range.selectNodeContents(holder)
					range.collapse(false)
					const sel = window.getSelection()
					sel.removeAllRanges()
					sel.addRange(range)
				} else {
					this.api.caret.focus(true)
				}
			} else {
				this.api.caret.focus(true)
			}
		}, 0)
	}

	save(blockContent) {
		return { text: blockContent.innerHTML }
	}

	_isImage(text) {
		return /!\[.+?\]\(.+?\)/.test(text)
	}

	_extractImage(text) {
		const match = text.match(/!\[(.+?)\]\((.+?)\)/)
		if (match) return { alt: match[1], url: match[2] }
		return { alt: '', url: '' }
	}

	_isEmbed(text) {
		return /^https?:\/\/.+/.test(text.trim())
	}

	_parsePastedHTMLToBlocks(html) {
		const doc = new DOMParser().parseFromString(html, 'text/html')
		const blocks = []
		const push = (block) => block && blocks.push(block)

		const handle = (node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent.replace(/�\u00a0/g, ' ').trim()
				if (text)
					push({
						type: 'paragraph',
						data: { text: escapeHTML(text) },
					})
				return
			}

			if (node.nodeType !== Node.ELEMENT_NODE) return

			const tag = node.tagName

			if (tag === 'PRE') {
				push({
					type: 'codeBox',
					data: {
						code: escapeHTML(node.textContent),
						language: this._codeLanguageFrom(node),
					},
				})
			} else if (/^H[1-6]$/.test(tag)) {
				if (this._hasText(node))
					push({
						type: 'header',
						data: {
							text: this._inline(node.childNodes),
							level: +tag[1],
						},
					})
			} else if (tag === 'UL' || tag === 'OL') {
				const items = this._parseListItems(node)
				if (items.length)
					push({
						type: 'list',
						data: {
							style: tag === 'UL' ? 'unordered' : 'ordered',
							items,
						},
					})
				this._emitImages(node, push)
			} else if (tag === 'TABLE') {
				push(this._parseTable(node))
			} else if (tag === 'IMG') {
				push(this._imageBlock(node))
			} else if (tag === 'P' || tag === 'BLOCKQUOTE') {
				if (this._hasText(node))
					push({
						type: 'paragraph',
						data: { text: this._inline(node.childNodes) },
					})
				this._emitImages(node, push)
			} else if (INLINE_TAGS.has(tag)) {
				if (this._hasText(node))
					push({
						type: 'paragraph',
						data: { text: this._inline([node]) },
					})
			} else if (node.childNodes.length) {
				// FIGURE / DIV / SECTION / ARTICLE and other containers.
				for (const child of node.childNodes) handle(child)
			} else {
				const text = node.textContent.trim()
				if (text)
					push({
						type: 'paragraph',
						data: { text: escapeHTML(text) },
					})
			}
		}

		for (const child of doc.body.childNodes) handle(child)
		return blocks
	}

	// Inner <code> carries the most specific hint, so check it before the <pre>.
	_codeLanguageFrom(pre) {
		for (const el of [pre.querySelector('code'), pre]) {
			const className =
				typeof el?.className === 'string' ? el.className : ''
			for (const pattern of CODE_LANGUAGE_PATTERNS) {
				const match = className.match(pattern)
				if (match) return match[1]
			}
		}
		return 'plaintext'
	}

	// True when a node carries visible text (nbsp-aware).
	_hasText(node) {
		return node.textContent.replace(/�\u00a0/g, ' ').trim().length > 0
	}

	// Serialize a set of nodes to a whitelisted inline-HTML string. Unknown
	// wrappers keep their text but lose the tag; unsafe links/text are escaped.
	_inline(nodes) {
		let out = ''
		for (const child of nodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				out += escapeHTML(child.textContent)
				continue
			}
			if (child.nodeType !== Node.ELEMENT_NODE) continue

			const tag = child.tagName
			if (tag === 'BR') {
				out += '<br>'
				continue
			}
			if (tag === 'IMG') continue // images become their own blocks

			const mapped = INLINE_TAG_MAP[tag]
			const inner = this._inline(child.childNodes)

			if (mapped === 'a') {
				const href = this._safeHref(child.getAttribute('href'))
				out += href
					? `<a href="${escapeHTML(href)}">${inner}</a>`
					: inner
			} else if (mapped) {
				const cls = mapped === 'code' ? ' class="inline-code"' : ''
				out += `<${mapped}${cls}>${inner}</${mapped}>`
			} else {
				out += inner
			}
		}
		return out
	}

	_parseListItems(listNode) {
		const ordered = listNode.tagName === 'OL'
		return [...listNode.querySelectorAll(':scope > li')].flatMap((li) => {
			const nested = li.querySelector(':scope > ul, :scope > ol')
			// Content is the item's own inline text, excluding any nested list.
			const clone = li.cloneNode(true)
			clone
				.querySelectorAll(':scope > ul, :scope > ol')
				.forEach((n) => n.remove())
			const item = {
				content: this._inline(clone.childNodes),
				items: nested ? this._parseListItems(nested) : [],
			}
			// Image-only items serialize to '' (images are emitted as their own
			// blocks). In ordered lists keep the blank item so later steps keep
			// their numbers; in unordered lists hoist any nested items and drop
			// the blank bullet.
			if (item.content.trim() || ordered) return [item]
			return item.items
		})
	}

	_parseTable(tableNode) {
		// Scope to this table's own rows/cells; querySelectorAll would descend
		// into nested tables and duplicate their rows/text into the parent.
		const rows = [
			...tableNode.querySelectorAll(
				':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'
			),
		]
		if (!rows.length) return null

		const content = rows.map((tr) =>
			[...tr.querySelectorAll(':scope > th, :scope > td')].map((cell) =>
				this._inline(cell.childNodes)
			)
		)
		if (!content.length || !content[0].length) return null

		return {
			type: 'table',
			data: {
				withHeadings: rows[0].querySelector(':scope > th') != null,
				content,
			},
		}
	}

	_imageBlock(imgNode) {
		const url = this._safeSrc(imgNode.getAttribute('src'))
		if (!url) return null
		return {
			type: 'image',
			data: {
				url,
				caption: escapeHTML(imgNode.getAttribute('alt') || ''),
			},
		}
	}

	// Pull standalone images out of a text container into their own blocks.
	_emitImages(node, push) {
		node.querySelectorAll('img').forEach((img) =>
			push(this._imageBlock(img))
		)
	}

	_safeHref(href) {
		if (!href) return ''
		const h = href.trim()
		if (/^(https?:|mailto:|tel:)/i.test(h)) return h
		if (/^\/\//.test(h)) return '' // protocol-relative → cross-origin
		if (/^(\/|#|\.)/.test(h)) return h // same-site path / anchor
		return ''
	}

	_safeSrc(src) {
		if (!src) return ''
		const s = src.trim()
		if (/^https?:\/\//i.test(s)) return s
		if (/^data:image\//i.test(s)) return s // embedded base64 images
		if (/^\/\//.test(s)) return '' // protocol-relative → cross-origin
		if (/^\//.test(s)) return s // site-relative
		return ''
	}
}

export default Markdown
