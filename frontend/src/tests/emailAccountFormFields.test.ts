/**
 * toSettingsField: the mapping EmailAccountForm's credential, custom-server
 * and incoming/outgoing RenderField arrays go through on their way into
 * SettingsFields. `required` becomes `reqd` -- FieldsSection's own name for
 * it -- and everything else carries straight across.
 */
import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
	// emailAccounts.ts reaches @/composables/useSettingsListResource, which
	// pulls in @/utils and, through it, plyr. Plyr touches matchMedia at
	// import time, and jsdom has none.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.mock('@/utils', () => ({
	cleanError: (message: unknown) => message,
	validateEmail: (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e),
}))
vi.mock('frappe-ui', () => ({ call: vi.fn(), toast: {} }))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/composables/useSettingsListResource', () => ({
	reloadSettingsLists: vi.fn(),
}))

vi.stubGlobal('__', (s: string) => s)

import {
	toSettingsField,
	customServerFields,
	popularProviderFields,
} from '@/components/Settings/EmailAccount/emailAccounts'

describe('toSettingsField', () => {
	it('carries a required text field straight across, renaming required to reqd', () => {
		expect(
			toSettingsField({
				label: 'Password',
				name: 'password',
				type: 'password',
				placeholder: '********',
				required: true,
			})
		).toEqual({
			name: 'password',
			label: 'Password',
			description: undefined,
			placeholder: '********',
			reqd: true,
			type: 'password',
		})
	})

	it('drops placeholder and reqd for a checkbox, which SettingsField does not carry', () => {
		expect(
			toSettingsField({
				label: 'Use IMAP',
				name: 'use_imap',
				type: 'checkbox',
				description: 'Turn off to collect mail over POP3 instead.',
			})
		).toEqual({
			name: 'use_imap',
			label: 'Use IMAP',
			description: 'Turn off to collect mail over POP3 instead.',
			type: 'checkbox',
		})
	})

	it('maps an optional field to reqd: undefined rather than reqd: false', () => {
		const mapped = toSettingsField({
			label: 'Incoming server',
			name: 'email_server',
			type: 'text',
			placeholder: 'imap.yourcompany.com',
		})
		expect(mapped.reqd).toBeUndefined()
	})

	// A guard against the two field sets drifting from what the mapping
	// expects: every entry has to carry a name SettingsFields can key on.
	it('maps every credential and custom-server field to a name', () => {
		for (const field of [...popularProviderFields, ...customServerFields]) {
			expect(toSettingsField(field).name).toBe(field.name)
		}
	})
})
