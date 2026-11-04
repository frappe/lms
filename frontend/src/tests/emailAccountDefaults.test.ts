/**
 * emailConfig.defaultsBadgeLabel: the badge the Email Accounts list shows for
 * each account. The four cases are distinct because Frappe tracks the default
 * inbox and the default sender separately, and one account can hold both.
 *
 * The DB hands these fields back as 0/1 while the edit form works in booleans,
 * so both shapes have to read the same.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils', () => ({
	validateEmail: (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e),
}))

import { defaultsBadgeLabel } from '@/components/Settings/EmailAccount/emailConfig'

describe('defaultsBadgeLabel', () => {
	it('names both roles when the account holds both defaults', () => {
		expect(
			defaultsBadgeLabel({ default_incoming: true, default_outgoing: true })
		).toBe('Default Sending & Inbox')
	})

	it('names the inbox alone', () => {
		expect(
			defaultsBadgeLabel({ default_incoming: true, default_outgoing: false })
		).toBe('Default Inbox')
	})

	it('names sending alone', () => {
		expect(
			defaultsBadgeLabel({ default_incoming: false, default_outgoing: true })
		).toBe('Default Sending')
	})

	// Holding neither default says nothing about direction, so the label has to
	// come from what the account is actually enabled for. Reporting 'Inbox' for
	// every such account told admins a send-only relay receives mail.
	it('describes direction when the account holds neither default', () => {
		const neither = { default_incoming: false, default_outgoing: false }
		expect(
			defaultsBadgeLabel({ ...neither, enable_incoming: 1, enable_outgoing: 1 })
		).toBe('Sending & Inbox')
		expect(
			defaultsBadgeLabel({ ...neither, enable_incoming: 0, enable_outgoing: 1 })
		).toBe('Sending')
		expect(
			defaultsBadgeLabel({ ...neither, enable_incoming: 1, enable_outgoing: 0 })
		).toBe('Inbox')
	})

	it('says Disabled when the account is enabled for neither direction', () => {
		expect(
			defaultsBadgeLabel({
				default_incoming: false,
				default_outgoing: false,
				enable_incoming: 0,
				enable_outgoing: 0,
			})
		).toBe('Disabled')
	})

	it('reads the 0/1 the DB returns the same as booleans', () => {
		expect(
			defaultsBadgeLabel({ default_incoming: 1, default_outgoing: 1 })
		).toBe('Default Sending & Inbox')
		expect(
			defaultsBadgeLabel({
				default_incoming: 0,
				default_outgoing: 0,
				enable_incoming: 1,
				enable_outgoing: 0,
			})
		).toBe('Inbox')
	})

	it('treats a missing field as not default and not enabled', () => {
		expect(defaultsBadgeLabel({})).toBe('Disabled')
	})
})
