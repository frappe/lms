import type { API, InlineTool, InlineToolConstructorOptions } from '@editorjs/editorjs'
import { alignLeftIcon, alignCenterIcon, alignRightIcon } from './icons'

type AlignOption = 'left' | 'center' | 'right'

interface AlignSelection {
	start: number
	end: number
	div: HTMLElement | null
}

/**
 * Text-align inline tool, ported from automad's TextAlign. Unlike the decoration
 * tools it does not extend BaseInline: it wraps the whole block content in a
 * sanitized `<lms-align>` block-level element and sets its `text-align`. The
 * offset-based save/restore is copied verbatim from automad (fragile for richly
 * formatted blocks, but matches the reference behaviour).
 */
abstract class BaseTextAlign implements InlineTool {
	static get isInline(): boolean {
		return true
	}

	static get sanitize(): Record<string, boolean> {
		return { 'lms-align': true }
	}

	protected abstract get align(): AlignOption
	protected abstract get icon(): string

	protected readonly api: API
	private readonly tag = 'LMS-ALIGN'
	private readonly button: HTMLButtonElement
	private selection: AlignSelection | null = null
	private _state = false

	get state(): boolean {
		return this._state
	}

	set state(state: boolean) {
		this._state = state
		this.button.classList.toggle(this.api.styles.inlineToolButtonActive, state)
	}

	constructor({ api }: InlineToolConstructorOptions) {
		this.api = api
		this.button = document.createElement('button')
		this.button.type = 'button'
		this.button.classList.add(this.api.styles.inlineToolButton)
	}

	render(): HTMLElement {
		this.button.innerHTML = this.icon
		return this.button
	}

	surround(): void {
		this.saveSelection()
		if (this.state) {
			this.removeWrapper()
		} else {
			const node = this.api.selection.findParentTag(this.tag) ?? this.createWrapper()
			if (node) {
				node.style.textAlign = this.align
				node.style.display = 'block'
			}
		}
		this.restoreSelection()
	}

	checkState(): boolean {
		const node = this.api.selection.findParentTag(this.tag)
		this.state = node !== null && node.style.textAlign === this.align
		return this.state
	}

	private removeWrapper(): void {
		const node = this.api.selection.findParentTag(this.tag)
		if (!node) {
			return
		}
		this.api.selection.expandToTag(node)
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) {
			return
		}
		const range = selection.getRangeAt(0)
		const contents = range.extractContents()
		node.remove()
		range.insertNode(contents)
	}

	private createWrapper(): HTMLElement | null {
		const div = this.api.selection.findParentTag('DIV')
		if (!div) {
			return null
		}
		this.api.selection.expandToTag(div)
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) {
			return null
		}
		const range = selection.getRangeAt(0)
		const contents = range.extractContents()
		const node = document.createElement(this.tag)
		node.appendChild(contents)
		range.insertNode(node)
		return node
	}

	private saveSelection(): void {
		const selection = window.getSelection()
		this.selection = {
			start: selection ? selection.anchorOffset : 0,
			end: selection ? selection.focusOffset : 0,
			div: this.api.selection.findParentTag('DIV'),
		}
	}

	private restoreSelection(): void {
		const selection = window.getSelection()
		if (!selection || !this.selection || !this.selection.div) {
			return
		}
		selection.removeAllRanges()
		const wrapper = this.selection.div.querySelector(
			`:scope > ${this.tag.toLowerCase()}`
		)
		const element = wrapper ?? this.selection.div
		const anchor = element.childNodes[0]
		if (!anchor) {
			return
		}
		selection.setBaseAndExtent(
			anchor,
			this.selection.start,
			anchor,
			this.selection.end
		)
	}
}

export class AlignLeft extends BaseTextAlign {
	static get title(): string {
		return __('Align left')
	}

	protected get align(): AlignOption {
		return 'left'
	}

	protected get icon(): string {
		return alignLeftIcon
	}
}

export class AlignCenter extends BaseTextAlign {
	static get title(): string {
		return __('Align center')
	}

	protected get align(): AlignOption {
		return 'center'
	}

	protected get icon(): string {
		return alignCenterIcon
	}
}

export class AlignRight extends BaseTextAlign {
	static get title(): string {
		return __('Align right')
	}

	protected get align(): AlignOption {
		return 'right'
	}

	protected get icon(): string {
		return alignRightIcon
	}
}
