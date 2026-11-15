/** The avatar's "Open to Work" / "Hiring" indicator. */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { vi } from 'vitest'

window.__ = (text: string): string => text

vi.mock('frappe-ui', () => ({
	Avatar: {
		props: ['label', 'image', 'size'],
		template: `<div><slot name="indicator" /></div>`,
	},
	Tooltip: {
		props: ['text', 'side'],
		template: `<div><slot /></div>`,
	},
}))

import UserAvatar from '@/components/UserAvatar.vue'

const indicator = (openTo: string) =>
	mount(UserAvatar, {
		props: { user: { full_name: 'A', open_to: openTo } as any, size: '2xl' },
		global: { config: { globalProperties: { __: (s: string) => s } as any } },
	})

describe('UserAvatar indicator', () => {
<<<<<<< HEAD
	it('draws Open to Work as a solid green chip', () => {
		const html = indicator('Work').html()

		expect(html).toContain('bg-surface-green-7')
		expect(html).toContain('text-white')
	})

	it('draws Hiring as a solid violet chip', () => {
		const html = indicator('Hiring').html()

		expect(html).toContain('bg-surface-violet-7')
		expect(html).toContain('text-white')
	})

	it('uses no raw palette colour and no base ink on a tint', () => {
		const html = indicator('Work').html() + indicator('Hiring').html()

		// bg-purple-500 has no dark-mode value; ink-base is for solid surfaces
		// only, and pairing it with a -3 tint is what made the check vanish.
		expect(html).not.toContain('bg-purple-')
		expect(html).not.toContain('text-ink-base')
		expect(html).not.toContain('bg-surface-green-3')
	})
=======
	// Guards: open-to-work and hiring told apart by colour alone. Introduced in
	// #2468; test added with the a11y audit remediation.
	it.each([
		['Work', 'Open to Work', 'lucide-badge-check'],
		['Hiring', 'Hiring', 'lucide-briefcase'],
	])(
		'names the %s chip in text and shape, not colour',
		(openTo, label, icon) => {
			const wrapper = indicator(openTo)

			expect(wrapper.get('.sr-only').text()).toBe(label)
			expect(wrapper.get(`.${icon}`).attributes('aria-hidden')).toBe('true')
		}
	)
>>>>>>> ffe35ba (test: drop mocked frontend tests that only pin wiring or markup)
})
