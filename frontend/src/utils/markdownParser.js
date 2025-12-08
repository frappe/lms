import { CodeXml } from 'lucide-vue-next'
import { createApp, h } from 'vue'

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
		return { tags: ['P'] }
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
		}

		return this.wrapper
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

	_isLink(text) {
		return /\[.+?\]\(.+?\)/.test(text)
	}

	_extractLink(text) {
		const match = text.match(/\[(.+?)\]\((.+?)\)/)
		if (match) return { text: match[1], url: match[2] }
		return { text: '', url: '' }
	}

	_isEmbed(text) {
		return /^https?:\/\/.+/.test(text.trim())
	}
}

export default Markdown
