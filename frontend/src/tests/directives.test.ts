import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { registerDirectives } from '@/directives'

// v-safe-html has its own suite in safeHtmlDirective.test.ts, including the
// level mapping and the level scanner. This file covers v-external, the only
// other directive the app registers.

const withDirectives = (component: any) => ({
	global: { plugins: [{ install: registerDirectives }] },
	...component,
})

describe('v-external', () => {
	it('adds target and a rel that blocks reverse tabnabbing', () => {
		const wrapper = mount(
			{ template: `<a v-external href="https://x.test">x</a>` },
			withDirectives({})
		)
		expect(wrapper.attributes('target')).toBe('_blank')
		expect(wrapper.attributes('rel')).toContain('noopener')
		expect(wrapper.attributes('rel')).toContain('noreferrer')
	})
})
