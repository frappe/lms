import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Tooltip } from 'frappe-ui'
import UnsavedBadge from '@/components/UnsavedBadge.vue'

const HINT = 'Press Enter in the title to save this quiz'

const render = (missing: string[]) =>
	mount(UnsavedBadge, {
		props: { missing, hint: HINT },
		global: { mocks: { __: (text: string) => text } },
	})

describe('UnsavedBadge', () => {
	// Guards: a badge keyboard users cannot reach to hear its tooltip. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there.
	it('reads Not saved and is reachable by keyboard', () => {
		const badge = render([]).get('[data-testid="unsaved-badge"]')
		expect(badge.text()).toBe('Not saved')
		expect(badge.attributes('tabindex')).toBe('0')
	})

	// Guards: the tooltip listing missing fields wrongly. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there.
	it.each([
		[[], HINT],
		[['a title'], 'Add a title to save'],
		[['a title', 'a question'], 'Add a title and a question to save'],
		[
			['a title', 'a question', 'a passing percentage'],
			'Add a title, a question, and a passing percentage to save',
		],
	])('with %j missing, the tooltip says %s', (missing, text) => {
		expect(render(missing).findComponent(Tooltip).props('text')).toBe(text)
	})

	// Guards: Intl.ListFormat throwing at mount on the dev page's raw
	// "{{ boot.lang }}" lang. Introduced in this branch (feat/onboarding-flows,
	// PR pending); test added there with the locale guard fix.
	it('mounts when the page lang is not a valid locale', () => {
		const lang = document.documentElement.lang
		document.documentElement.lang = '{{ boot.lang }}'
		try {
			expect(render(['a title']).findComponent(Tooltip).props('text')).toBe(
				'Add a title to save'
			)
		} finally {
			document.documentElement.lang = lang
		}
	})
})
