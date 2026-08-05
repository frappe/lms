import { BaseInline } from './BaseInline'
import { underlineIcon } from './icons'

export class Underline extends BaseInline {
	static get title(): string {
		return __('Underline')
	}

	static get sanitize(): Record<string, boolean> {
		return { u: true }
	}

	protected get tag(): string {
		return 'U'
	}

	protected get icon(): string {
		return underlineIcon
	}
}
