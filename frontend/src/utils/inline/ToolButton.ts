import type {
	API,
	InlineTool,
	InlineToolConstructorOptions,
} from '@editorjs/editorjs'

/**
 * The toolbar button an inline tool owns, and the active flag EditorJS toggles
 * through `checkState`.
 *
 * It lives here because the two families of tool share nothing else: the
 * decoration tools wrap a range, the align tools wrap a whole block, so neither
 * can inherit the other's `surround`. The button was copied between them.
 */
export abstract class ToolButton implements InlineTool {
	static get isInline(): boolean {
		return true
	}

	protected abstract get icon(): string

	protected readonly api: API
	protected readonly button: HTMLButtonElement
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

	// The icon is read here, not in the constructor: an abstract member is not
	// available while the base constructor runs.
	render(): HTMLElement {
		this.button.innerHTML = this.icon
		return this.button
	}

	abstract surround(range: Range): void

	abstract checkState(): boolean
}
