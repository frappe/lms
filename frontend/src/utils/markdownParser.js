export class MarkdownParser {
	constructor({ data, api, readOnly, config }) {
		console.log('markdownParser constructor called')
		this.api = api
		this.data = data || {}
		this.config = config || {}
		this.text = this.data.text || ''
		this.readOnly = readOnly
	}

	static get toolbox() {
		const app = createApp({
			render: () =>
				h(UploadIcon, { size: 18, strokeWidth: 1.5, color: 'black' }),
		})

		const div = document.createElement('div')
		app.mount(div)

		return {
			title: 'Upload',
			icon: div.innerHTML,
		}
	}

	static get isReadOnlySupported() {
		return true
	}

	render() {
		console.log('  render() called')
		const container = document.createElement('div')
		container.contentEditable = true // Make the div editable like a textarea
		container.classList.add('markdown-parser')
		container.textContent = this.text

		container.addEventListener('blur', () => {
			this.text = container.textContent.trim()
			this.parseMarkdown()
		})

		this.textArea = container
		return container
	}

	save(blockContent) {
		return {
			text: this.text,
		}
	}

	/**
	 * Parse Markdown text and render Editor.js blocks.
	 */
	parseMarkdown() {
		console.log('  parseMarkdown() called')
		const markdown = this.text
		const lines = markdown.split('\n')

		const blocks = lines.map((line) => {
			if (line.startsWith('# ')) {
				return {
					type: 'header',
					data: { text: line.replace('# ', ''), level: 1 },
				}
			} else if (line.startsWith('## ')) {
				return {
					type: 'header',
					data: { text: line.replace('## ', ''), level: 2 },
				}
			} else if (line.startsWith('- ')) {
				return {
					type: 'list',
					data: {
						items: [line.replace('- ', '')],
						style: 'unordered',
					},
				}
			} else if (this.isImage(line)) {
				const { alt, url } = this.extractImage(line)
				return {
					type: 'image',
					data: {
						file: { url },
						caption: alt,
						withBorder: false,
						stretched: false,
						withBackground: false,
					},
				}
			} else if (this.isLink(line)) {
				const { text, url } = this.extractLink(line)
				return {
					type: 'linkTool',
					data: { link: url, meta: { title: text } },
				}
			} else {
				return { type: 'paragraph', data: { text: line } }
			}
		})

		this.api.blocks.render({ blocks })
	}

	/**
	 * Check if the line matches the image syntax.
	 * @param {string} line - The line of text.
	 * @returns {boolean}
	 */
	isImage(line) {
		return /^!\[.*\]\(.*\)$/.test(line)
	}

	/**
	 * Extract alt text and URL from the image syntax.
	 * @param {string} line - The line of text.
	 * @returns {Object} { alt, url }
	 */
	extractImage(line) {
		const match = line.match(/^!\[(.*)\]\((.*)\)$/)
		return { alt: match[1], url: match[2] }
	}

	/**
	 * Check if the line matches the link syntax.
	 * @param {string} line - The line of text.
	 * @returns {boolean}
	 */
	isLink(line) {
		return /^\[.*\]\(.*\)$/.test(line)
	}

	/**
	 * Extract text and URL from the link syntax.
	 * @param {string} line - The line of text.
	 * @returns {Object} { text, url }
	 */
	extractLink(line) {
		const match = line.match(/^\[(.*)\]\((.*)\)$/)
		return { text: match[1], url: match[2] }
	}
}

export default MarkdownParser
