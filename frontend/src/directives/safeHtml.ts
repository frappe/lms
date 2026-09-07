import type { Directive } from 'vue'
import { sanitizeAt } from './safeHtmlLevels'

// Default-safe replacement for v-html. The level is the directive argument:
// v-safe-html:rich, v-safe-html:basic, v-safe-html:bio.
const render = (
	el: HTMLElement,
	level: string | undefined,
	value?: string | null
) => {
	el.innerHTML = sanitizeAt(level, value)
}

const safeHtml: Directive<HTMLElement, string | null | undefined> = {
	mounted: (el, binding) => render(el, binding.arg, binding.value),
	updated: (el, binding) => {
		if (binding.value !== binding.oldValue)
			render(el, binding.arg, binding.value)
	},
}

export default safeHtml
