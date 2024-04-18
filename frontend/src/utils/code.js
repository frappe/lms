import { getLineStartPosition } from './index.js'

export class CodeTool {
	static get isReadOnlySupported() {
		return true
	}

	static get enableLineBreaks() {
		return true
	}

	constructor({ data, config, api, readOnly }) {
		this.api = api
		this.readOnly = readOnly

		this.placeholder = this.api.i18n.t(
			config.placeholder || CodeTool.DEFAULT_PLACEHOLDER
		)

		this.CSS = {
			baseClass: this.api.styles.block,
			input: this.api.styles.input,
			wrapper: 'ce-code',
			textarea: 'ce-code__textarea',
			select: 'ce-code__languagecode',
		}

		if (config.languageList) {
			this.languageList = config.languageList
		} else {
			this.languageList = [
				{ name: 'Select Language', code: '' },
				{ name: 'HTML', code: 'html' },
				{ name: 'CSS', code: 'css' },
				{ name: 'JavaScript', code: 'js' },
				{ name: 'C#', code: 'csharp' },
				{ name: 'ASP.NET (C#)', code: 'aspnet' },
				{ name: 'Docker', code: 'docker' },
				{ name: 'Git', code: 'git' },
				{ name: 'Java', code: 'java' },
				{ name: 'JSON', code: 'json' },
				{ name: 'JSONP', code: 'jsonp' },
				{ name: 'JSON5', code: 'json5' },
				{ name: 'PowerShell', code: 'powershell' },
				{ name: 'Python', code: 'python' },
				{ name: 'React JSX', code: 'jsx' },
				{ name: 'React TSX', code: 'tsx' },
				{ name: 'Regex', code: 'regex' },
				{ name: 'Sass (Sass)', code: 'sass' },
				{ name: 'Sass (Scss)', code: 'scss' },
				{ name: 'SQL', code: 'sql' },
				{ name: 'TypeScript', code: 'typescript' },
				{ name: 'YAML', code: 'yaml' },
			]
		}

		if (config.additionalLanguages) {
			this.languageList.push(...config.additionalLanguages)
		}

		this.nodes = {
			holder: null,
			textarea: null,
			picker: null,
		}

		this.data = {
			code: data.code || '',
			languageCode: data.languageCode?.replace('language-', '') || '',
		}

		this.nodes.holder = this.drawView()
	}

	drawView() {
		const wrapper = document.createElement('div'),
			textarea = document.createElement('textarea'),
			picker = document.createElement('select')

		this.languageList.forEach((item) => {
			let option = document.createElement('option')
			option.text = item.name
			option.value = item.code
			picker.appendChild(option)
		})

		wrapper.classList.add(this.CSS.baseClass, this.CSS.wrapper)
		textarea.classList.add(this.CSS.textarea, this.CSS.input)
		textarea.textContent = this.data.code
		picker.value = this.data.languageCode

		textarea.placeholder = this.placeholder

		if (this.readOnly) {
			textarea.disabled = true
			picker.disabled = true
		}

		wrapper.appendChild(picker)
		wrapper.appendChild(textarea)

		textarea.addEventListener('keydown', (event) => {
			switch (event.code) {
				case 'Tab':
					this.tabHandler(event)
					break
			}
		})

		this.nodes.textarea = textarea
		this.nodes.picker = picker

		return wrapper
	}

	render() {
		return this.nodes.holder
	}

	save(codeWrapper) {
		return {
			code: codeWrapper.querySelector('textarea').value,
			languageCode: `language-${
				codeWrapper.querySelector('select').value
			}`,
		}
	}

	onPaste(event) {
		const content = event.detail.data

		this.data = {
			code: content.textContent,
		}
	}

	get data() {
		return this._data
	}

	set data(data) {
		this._data = data

		if (this.nodes.textarea) {
			this.nodes.textarea.textContent = data.code
		}

		if (this.nodes.picker) {
			this.nodes.picker.value = data.languageCode
		}
	}

	static get toolbox() {
		return {
			icon: '<svg width="14" height="14" viewBox="0 -1 14 14" xmlns="http://www.w3.org/2000/svg" > <path d="M3.177 6.852c.205.253.347.572.427.954.078.372.117.844.117 1.417 0 .418.01.725.03.92.02.18.057.314.107.396.046.075.093.117.14.134.075.027.218.056.42.083a.855.855 0 0 1 .56.297c.145.167.215.38.215.636 0 .612-.432.934-1.216.934-.457 0-.87-.087-1.233-.262a1.995 1.995 0 0 1-.853-.751 2.09 2.09 0 0 1-.305-1.097c-.014-.648-.029-1.168-.043-1.56-.013-.383-.034-.631-.06-.733-.064-.263-.158-.455-.276-.578a2.163 2.163 0 0 0-.505-.376c-.238-.134-.41-.256-.519-.371C.058 6.76 0 6.567 0 6.315c0-.37.166-.657.493-.846.329-.186.56-.342.693-.466a.942.942 0 0 0 .26-.447c.056-.2.088-.42.097-.658.01-.25.024-.85.043-1.802.015-.629.239-1.14.672-1.522C2.691.19 3.268 0 3.977 0c.783 0 1.216.317 1.216.921 0 .264-.069.48-.211.643a.858.858 0 0 1-.563.29c-.249.03-.417.076-.498.126-.062.04-.112.134-.139.291-.031.187-.052.562-.061 1.119a8.828 8.828 0 0 1-.112 1.378 2.24 2.24 0 0 1-.404.963c-.159.212-.373.406-.64.583.25.163.454.342.612.538zm7.34 0c.157-.196.362-.375.612-.538a2.544 2.544 0 0 1-.641-.583 2.24 2.24 0 0 1-.404-.963 8.828 8.828 0 0 1-.112-1.378c-.009-.557-.03-.932-.061-1.119-.027-.157-.077-.251-.14-.29-.08-.051-.248-.096-.496-.127a.858.858 0 0 1-.564-.29C8.57 1.401 8.5 1.185 8.5.921 8.5.317 8.933 0 9.716 0c.71 0 1.286.19 1.72.574.432.382.656.893.671 1.522.02.952.033 1.553.043 1.802.009.238.041.458.097.658a.942.942 0 0 0 .26.447c.133.124.364.28.693.466a.926.926 0 0 1 .493.846c0 .252-.058.446-.183.58-.109.115-.281.237-.52.371-.21.118-.377.244-.504.376-.118.123-.212.315-.277.578-.025.102-.045.35-.06.733-.013.392-.027.912-.042 1.56a2.09 2.09 0 0 1-.305 1.097c-.2.323-.486.574-.853.75a2.811 2.811 0 0 1-1.233.263c-.784 0-1.216-.322-1.216-.934 0-.256.07-.47.214-.636a.855.855 0 0 1 .562-.297c.201-.027.344-.056.418-.083.048-.017.096-.06.14-.134a.996.996 0 0 0 .107-.396c.02-.195.031-.502.031-.92 0-.573.039-1.045.117-1.417.08-.382.222-.701.427-.954z" /> </svg>',
			title: 'Code',
		}
	}

	static get DEFAULT_PLACEHOLDER() {
		return 'Enter a code'
	}

	static get pasteConfig() {
		return {
			tags: ['pre'],
		}
	}

	static get sanitize() {
		return {
			code: true, // Allow HTML tags
		}
	}

	tabHandler(event) {
		/**
		 * Prevent editor.js tab handler
		 */
		event.stopPropagation()

		/**
		 * Prevent native tab behaviour
		 */
		event.preventDefault()

		const textarea = event.target
		const isShiftPressed = event.shiftKey
		const caretPosition = textarea.selectionStart
		const value = textarea.value
		const indentation = '  '

		let newCaretPosition

		/**
		 * For Tab pressing, just add an indentation to the caret position
		 */
		if (!isShiftPressed) {
			newCaretPosition = caretPosition + indentation.length

			textarea.value =
				value.substring(0, caretPosition) +
				indentation +
				value.substring(caretPosition)
		} else {
			/**
			 * For Shift+Tab pressing, remove an indentation from the start of line
			 */
			const currentLineStart = getLineStartPosition(value, caretPosition)
			const firstLineChars = value.substr(
				currentLineStart,
				indentation.length
			)

			if (firstLineChars !== indentation) {
				return
			}

			/**
			 * Trim the first two chars from the start of line
			 */
			textarea.value =
				value.substring(0, currentLineStart) +
				value.substring(currentLineStart + indentation.length)
			newCaretPosition = caretPosition - indentation.length
		}

		/**
		 * Restore the caret
		 */
		textarea.setSelectionRange(newCaretPosition, newCaretPosition)
	}
}
