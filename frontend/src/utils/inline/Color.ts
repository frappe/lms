import { BaseInline } from './BaseInline'
import { paintBucketIcon } from './icons'

/**
 * Convert a CSS `rgb(r, g, b)` string to `#rrggbb` so it can seed a native
 * `<input type="color">` (which only accepts hex). Returns hex/empty unchanged.
 */
function rgbToHex(value: string): string {
	const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
	if (!match) {
		return value
	}
	const toHex = (part: string): string =>
		Number(part).toString(16).padStart(2, '0')
	return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`
}

/**
 * Text-color + highlight inline tool. Wraps the selection in a sanitized
 * `<lms-inline-color>` element carrying inline `color` / `background-color`,
 * edited via two native color inputs in the toolbar action panel.
 *
 * frappe-ui ships no ColorPicker component, so native `<input type="color">`
 * is used here (verified against node_modules/frappe-ui/src/components).
 */
export class Color extends BaseInline {
	private panel: HTMLElement | null = null
	private textInput: HTMLInputElement | null = null
	private backgroundInput: HTMLInputElement | null = null

	static get title(): string {
		return __('Color')
	}

	static get sanitize(): Record<string, boolean> {
		return { 'lms-inline-color': true }
	}

	protected get tag(): string {
		return 'LMS-INLINE-COLOR'
	}

	protected get icon(): string {
		return paintBucketIcon
	}

	renderActions(): HTMLElement {
		this.panel = document.createElement('div')
		this.panel.classList.add('lms-inline-color__panel')
		this.panel.hidden = true

		this.textInput = this.createInput(__('Text color'))
		this.backgroundInput = this.createInput(__('Highlight'))

		this.panel.append(this.textInput.parentElement as HTMLElement)
		this.panel.append(this.backgroundInput.parentElement as HTMLElement)

		return this.panel
	}

	protected showActions(node: HTMLElement): void {
		if (!this.panel || !this.textInput || !this.backgroundInput) {
			return
		}
		const { color, backgroundColor } = node.style
		if (color) {
			this.textInput.value = rgbToHex(color)
		}
		if (backgroundColor) {
			this.backgroundInput.value = rgbToHex(backgroundColor)
		}
		this.listen(this.textInput, 'input change', (): void => {
			node.style.color = (this.textInput as HTMLInputElement).value
		})
		this.listen(this.backgroundInput, 'input change', (): void => {
			node.style.backgroundColor = (
				this.backgroundInput as HTMLInputElement
			).value
		})
		this.panel.hidden = false
	}

	protected hideActions(): void {
		if (this.panel) {
			this.panel.hidden = true
		}
	}

	private createInput(label: string): HTMLInputElement {
		const field = document.createElement('label')
		field.classList.add('lms-inline-color__field')
		field.textContent = label
		const input = document.createElement('input')
		input.type = 'color'
		field.append(input)
		return input
	}
}
