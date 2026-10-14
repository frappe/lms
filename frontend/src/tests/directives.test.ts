import { describe, expect, it } from 'vitest'
import { createApp, h, resolveDirective, withDirectives } from 'vue'
import { registerDirectives } from '@/directives'

// v-safe-html has its own suite in safeHtmlDirective.test.ts, including the
// level mapping and the level scanner. This file covers v-external, the only
// other directive the app registers.
//
// A bare createApp rather than mount(): setup.ts already registers both
// directives on every mount(), so registering them again there would only
// test that Vue warns about the duplicate.
describe('v-external', () => {
	it('adds target and a rel that blocks reverse tabnabbing', () => {
		const app = createApp({
			render: () =>
				withDirectives(h('a', { href: 'https://x.test' }, 'x'), [
					[resolveDirective('external')!],
				]),
		})
		registerDirectives(app)
		const host = document.createElement('div')
		app.mount(host)
		const link = host.querySelector('a')!

		expect(link.getAttribute('target')).toBe('_blank')
		expect(link.getAttribute('rel')).toContain('noopener')
		expect(link.getAttribute('rel')).toContain('noreferrer')
		app.unmount()
	})
})
