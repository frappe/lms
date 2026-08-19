import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { registerDirectives } from '@/directives'

// v-safe-html has its own suite in safeHtmlDirective.test.ts, including the
// level mapping and the source scanners. This file covers v-external, the only
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

describe('every external link uses the directive', () => {
	const sources = import.meta.glob('../**/*.vue', {
		query: '?raw',
		import: 'default',
		eager: true,
	}) as Record<string, string>

	it('finds components to scan', () => {
		expect(Object.keys(sources).length).toBeGreaterThan(50)
	})

	it('finds no bare target="_blank"', () => {
		const offenders = Object.entries(sources)
			.filter(([, src]) => /target\s*=\s*"_blank"/.test(src))
			.map(([path]) => path)
		expect(offenders, offenders.join('\n')).toEqual([])
	})
})
