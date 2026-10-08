import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { safeHtml, vExternal } from '../directives'

// main.js registers these on the app, so a component that uses one renders
// wrong under a bare mount() and the failure looks like missing data rather
// than a missing directive. Registering them here keeps component tests
// rendering what the app renders.
config.global.directives = {
	...config.global.directives,
	'safe-html': safeHtml,
	external: vExternal,
}

config.global.stubs = {
	...config.global.stubs,
	ScrollArea: defineComponent({
		name: 'ScrollArea',
		props: { viewportClass: { type: String, default: '' } },
		setup(props, { attrs, slots }) {
			return () =>
				h('div', { ...attrs, 'data-slot': 'scroll-area' }, [
					h(
						'div',
						{ class: props.viewportClass, 'data-slot': 'scroll-area-viewport' },
						slots.default?.()
					),
				])
		},
	}),
}

// main.js puts `__` on window; without it a script-block translation dies on a
// bare ReferenceError. Mirrors translate(), including the contract that a
// message with {0} returns a { format } object rather than a string.
vi.stubGlobal('__', (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, index) =>
				args[Number(index)] === undefined ? match : String(args[Number(index)])
			),
	}
})
