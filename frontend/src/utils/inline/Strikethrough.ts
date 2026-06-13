import { BaseInline } from './BaseInline'
import { strikethroughIcon } from './icons'

export class Strikethrough extends BaseInline {
	static get title(): string {
		return __('Strikethrough')
	}

	static get sanitize(): Record<string, boolean> {
		return { s: true }
	}

	protected get tag(): string {
		return 'S'
	}

	protected get icon(): string {
		return strikethroughIcon
	}
}
