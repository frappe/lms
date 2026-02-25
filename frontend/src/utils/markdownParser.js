import { CodeXml } from 'lucide-vue-next'
import { createApp, h } from 'vue'
import { escapeHTML } from '@/utils'

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

		const pastedText = clipboardData.getData('text/plain')

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

	async _insertMarkdownAsBlocks(markdown) {
		const blocks = this._parseMarkdownToBlocks(markdown)

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
		} catch (error) {
			console.error('Failed to delete original block:', error)
		}

		setTimeout(() => {
			this.api.caret.setToBlock(currentIndex, 'end')
		}, 100)
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
					code: codeLines.join('\n'),
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
}

export default Markdown
