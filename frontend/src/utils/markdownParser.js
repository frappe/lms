import { CodeXml } from 'lucide-vue-next'
import { createApp, h } from 'vue'

export class Markdown {
	constructor({ data, api, readOnly, config }) {
		this.api = api
		this.data = data || {}
		this.config = config || {}
		this.text = data.text || ''
		this.readOnly = readOnly
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
		return {
			title: '',
			icon: div.innerHTML,
		}
	}

	onPaste(event) {
		const data = {
			text: event.detail.data.innerHTML,
		}

		this.data = data
		window.requestAnimationFrame(() => {
			if (!this.wrapper) {
				return
			}
			this.wrapper.innerHTML = this.data.text || ''
		})
	}

	static get pasteConfig() {
		return {
			tags: ['P'],
		}
	}

	render() {
		this.wrapper = document.createElement('div')
		this.wrapper.classList.add('cdx-block', 'ce-paragraph')
		this.wrapper.innerHTML = this.text

		if (!this.readOnly) {
			this.wrapper.contentEditable = true
			this.wrapper.innerHTML = this.text

			this.wrapper.addEventListener('focus', () =>
				this._togglePlaceholder()
			)
			this.wrapper.addEventListener('blur', () =>
				this._togglePlaceholder()
			)

			this.wrapper.addEventListener('input', (event) => {
				this._togglePlaceholder()
				let value = event.target.textContent
				if (event.keyCode === 32 && value.startsWith('#')) {
					this.convertToHeader(event, value)
				} else if (event.keyCode == 189) {
					this.convertBlock('list', {
						style: 'unordered',
					})
				} else if (/^[a-zA-Z]/.test(event.key)) {
					this.convertBlock('paragraph', {
						text: value,
					})
				} else if (event.keyCode === 13 || event.keyCode === 190) {
					this.parseContent(event)
				}
			})
		}

		return this.wrapper
	}

	_togglePlaceholder() {
		const blocks = document.querySelectorAll(
			'.cdx-block.ce-paragraph[data-placeholder]'
		)
		blocks.forEach((block) => {
			if (block !== this.wrapper) {
				delete block.dataset.placeholder
			}
		})
		if (this.wrapper.innerHTML.trim() === '') {
			this.wrapper.dataset.placeholder = this.placeholder
		} else {
			delete this.wrapper.dataset.placeholder
		}
	}

	convertToHeader(event, value) {
		event.preventDefault()
		if (['#', '##', '###', '####', '#####', '######'].includes(value)) {
			let level = value.length
			event.target.textContent = ''
			this.convertBlock('header', {
				level: level,
			})
		}
	}

	parseContent(event) {
		event.preventDefault()
		let previousLine = this.wrapper.textContent
		if (event.keyCode === 190) {
			previousLine = previousLine + '.'
		}

		if (previousLine && this.hasImage(previousLine)) {
			this.wrapper.textContent = ''
			this.convertBlock('image')
		} else if (previousLine && this.hasLink(previousLine)) {
			const { text, url } = this.extractLink(previousLine)
			const anchorTag = `<a href="${url}" target="_blank">${text}</a>`
			this.convertBlock('paragraph', {
				text: previousLine.replace(/\[.+?\]\(.+?\)/, anchorTag),
			})
		} else if (previousLine && previousLine.startsWith('- ')) {
			this.convertBlock('list', {
				style: 'unordered',
				items: [
					{
						content: previousLine.replace('- ', ''),
					},
				],
			})
		} else if (previousLine && previousLine.startsWith('1.')) {
			this.convertBlock('list', {
				style: 'ordered',
				items: [
					{
						content: previousLine.replace('1.', ''),
					},
				],
			})
		} else if (previousLine && this.canBeEmbed(previousLine)) {
			this.wrapper.textContent = ''
			this.convertBlock('embed', {
				source: previousLine,
			})
		} else {
			this.convertBlock('paragraph', {
				text: previousLine,
			})
		}
	}

	async convertBlock(type, data, index = null) {
		const currentIndex = this.api.blocks.getCurrentBlockIndex()
		const currentBlock = this.api.blocks.getBlockByIndex(currentIndex)
		await this.api.blocks.convert(currentBlock.id, type, data)
		this.api.caret.focus(true)
	}

	save(blockContent) {
		return {
			text: blockContent.innerHTML,
		}
	}

	hasImage(line) {
		return /!\[.+?\]\(.+?\)/.test(line)
	}

	extractImage(line) {
		const match = line.match(/!\[(.+?)\]\((.+?)\)/)
		if (match) {
			return { alt: match[1], url: match[2] }
		}
		return { alt: '', url: '' }
	}

	hasLink(line) {
		return /\[.+?\]\(.+?\)/.test(line)
	}

	extractLink(line) {
		const match = line.match(/\[(.+?)\]\((.+?)\)/)
		if (match) {
			return { text: match[1], url: match[2] }
		}
		return { text: '', url: '' }
	}

	canBeEmbed(line) {
		return /^https?:\/\/.+/.test(line.trim())
	}
}

export default Markdown
