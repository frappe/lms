/**
 * The avatar's "Open to Work" / "Hiring" indicator.
 *
 * Both indicators are solid colour chips with a check glyph on top, so they have
 * to use frappe-ui's solid pairing for that colour — `ink-<colour>-1` on
 * `surface-<colour>-7` (Badge.vue:53-78). Neither did:
 *
 * - Work drew `text-ink-base` on `bg-surface-green-3`. In light mode `--ink-base`
 *   is oklch(1 0 0) — the same value as `--surface-base` — and surface-green-3 is
 *   a pale tint at oklch(.908 .07 154.3). White on that is ~1.1:1: the check was
 *   invisible.
 * - Hiring drew it on `bg-purple-500`, a raw palette colour built from
 *   lightModeColors regardless of theme, while its ink flipped to oklch(.205 0 0)
 *   in dark mode — a near-black check on an unchanged purple.
 */
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
		props: ['text', 'placement'],
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
	it('draws Open to Work as a solid green chip', () => {
		const html = indicator('Work').html()

		expect(html).toContain('bg-surface-green-7')
		expect(html).toContain('text-ink-green-1')
	})

	it('draws Hiring as a solid violet chip', () => {
		const html = indicator('Hiring').html()

		expect(html).toContain('bg-surface-violet-7')
		expect(html).toContain('text-ink-violet-1')
	})

	it('uses no raw palette colour and no base ink on a tint', () => {
		const html = indicator('Work').html() + indicator('Hiring').html()

		// bg-purple-500 has no dark-mode value; ink-base is for solid surfaces
		// only, and pairing it with a -3 tint is what made the check vanish.
		expect(html).not.toContain('bg-purple-')
		expect(html).not.toContain('text-ink-base')
		expect(html).not.toContain('bg-surface-green-3')
	})
})
