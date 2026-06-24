import type { API, InlineTool, InlineToolConstructorOptions } from '@editorjs/editorjs'

/**
 * Range-based inline tool base class, ported from automad's BaseInline. Wraps
 * and unwraps the selection in `this.tag` using the Range API directly (no
 * deprecated `document.execCommand`). Subclasses declare `tag` and `icon`;
 * tools with an action panel (e.g. Color) override `renderActions`/`showActions`.
 */
export abstract class BaseInline implements InlineTool {
	static get isInline(): boolean {
		return true
	}

	protected abstract get tag(): string
	protected abstract get icon(): string

	protected readonly api: API
	private readonly button: HTMLButtonElement
	private removers: Array<() => void> = []
	private savedRange: Range | null = null
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
		this.button.innerHTML = this.icon
	}

	render(): HTMLElement {
		return this.button
	}

	surround(range: Range): void {
		if (this.state) {
			this.unwrap()
			return
		}
		this.wrap(range)
	}

	wrap(range: Range): void {
		const contents = range.extractContents()
		const node = document.createElement(this.tag)
		node.appendChild(contents)
		range.insertNode(node)
		this.api.selection.expandToTag(node)
	}

	unwrap(): void {
		this.restoreSelection()
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

	checkState(): boolean {
		const node = this.api.selection.findParentTag(this.tag)
		this.state = node !== null
		if (this.state && node) {
			this.saveSelection()
			setTimeout((): void => {
				this.showActions(node)
			}, 0)
		} else {
			this.hideActions()
		}
		return this.state
	}

	clear(): void {
		this.removers.forEach((remove): void => {
			remove()
		})
		this.removers = []
	}

	protected listen(
		element: HTMLElement | Document | Window,
		events: string,
		callback: (event: Event) => void
	): void {
		events.split(' ').forEach((event): void => {
			element.addEventListener(event, callback)
			this.removers.push((): void => {
				element.removeEventListener(event, callback)
			})
		})
	}

	protected showActions(_node: HTMLElement): void {}

	protected hideActions(): void {}

	private saveSelection(): void {
		const selection = window.getSelection()
		this.savedRange =
			selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
	}

	private restoreSelection(): void {
		const selection = window.getSelection()
		if (!selection || !this.savedRange) {
			return
		}
		selection.removeAllRanges()
		selection.addRange(this.savedRange)
	}
}
