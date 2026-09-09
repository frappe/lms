/**
 * defaultsBadgeLabel: the badge the Email Accounts list shows for
 * each account. The four cases are distinct because Frappe tracks the default
 * inbox and the default sender separately, and one account can hold both.
 *
 * The DB hands these fields back as 0/1 while the edit form works in booleans,
 * so both shapes have to read the same.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils', () => ({
	cleanError: (message: unknown) => message,
	validateEmail: (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e),
}))
// The badge moved into the page's config module, which also carries the list's
// actions — so the modules those reach for are stubbed rather than loaded.
vi.mock('frappe-ui', () => ({ call: vi.fn(), toast: {} }))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/composables/useSettingsListResource', () => ({
	reloadSettingsLists: vi.fn(),
}))

import { defaultsBadgeLabel } from '@/components/Settings/EmailAccount/emailAccounts'

// Every fixture carries the enable flags as well as the defaults, because a
// default counts only for a direction the account is enabled for -- the same
// reading the row menu takes. A real row always has both halves.
describe('defaultsBadgeLabel', () => {
	it('names both roles when the account holds both defaults', () => {
		expect(
			defaultsBadgeLabel({
				default_incoming: true,
				default_outgoing: true,
				enable_incoming: 1,
				enable_outgoing: 1,
			})
		).toBe('Default Sending & Inbox')
	})

	it('names the inbox alone', () => {
		expect(
			defaultsBadgeLabel({
				default_incoming: true,
				default_outgoing: false,
				enable_incoming: 1,
				enable_outgoing: 1,
			})
		).toBe('Default Inbox')
	})

	it('names sending alone', () => {
		expect(
			defaultsBadgeLabel({
				default_incoming: false,
				default_outgoing: true,
				enable_incoming: 1,
				enable_outgoing: 1,
			})
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
			defaultsBadgeLabel({
				default_incoming: 1,
				default_outgoing: 1,
				enable_incoming: 1,
				enable_outgoing: 1,
			})
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

describe('a default flag on a direction that is switched off', () => {
	/**
	 * The row menu offers its two entries only for a direction the account is
	 * enabled for, on the reasoning that frappe resolves a default inbox as
	 * `enable_incoming` AND `default_incoming`. The badge read the flags alone,
	 * so switching incoming off on the account holding the default inbox left it
	 * advertising "Default Inbox" while "Clear default inbox" had already
	 * disappeared: a claim the user could neither rely on nor withdraw.
	 */
	it('does not report an inbox default the account cannot serve', () => {
		expect(
			defaultsBadgeLabel({
				default_incoming: 1,
				enable_incoming: 0,
				enable_outgoing: 1,
			})
		).toBe('Sending')
	})

	it('does not report a sending default the account cannot serve', () => {
		expect(
			defaultsBadgeLabel({
				default_outgoing: 1,
				enable_outgoing: 0,
				enable_incoming: 1,
			})
		).toBe('Inbox')
	})

	it('still reports both when both directions are on', () => {
		expect(
			defaultsBadgeLabel({
				default_incoming: 1,
				default_outgoing: 1,
				enable_incoming: 1,
				enable_outgoing: 1,
			})
		).toBe('Default Sending & Inbox')
	})
})
