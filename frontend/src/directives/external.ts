import type { Directive } from 'vue'

// A bare target="_blank" hands the opened page a window.opener reference back
// to ours — reverse tabnabbing. Every external link goes through here so the
// rel can never be forgotten at a call site.
export const vExternal: Directive<HTMLAnchorElement> = {
	mounted(el) {
		el.setAttribute('target', '_blank')
		el.setAttribute('rel', 'noopener noreferrer')
	},
}
