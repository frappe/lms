/**
 * Pure unit tests for emailConfig.validateInputs — the shared client-side guard
 * used by both EmailAdd (create) and EmailEdit (update, allowMissingPassword).
 */
import { describe, expect, it, vi } from 'vitest'

// validateEmail comes from @/utils (which pulls in heavy deps); stub it with a
// minimal but real-ish email check so we exercise validateInputs' own branches.
vi.mock('@/utils', () => ({
	validateEmail: (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e),
}))

import { validateInputs } from '@/components/Settings/EmailAccount/emailConfig'

const base = {
	email_account_name: 'Support',
	email_id: 'support@example.com',
	password: 'pw',
	api_key: 'k',
	api_secret: 's',
}

describe('validateInputs', () => {
	it('passes a complete popular-provider account', () => {
		expect(validateInputs(base, 'GMail')).toBe('')
	})

	it('requires an account name', () => {
		expect(validateInputs({ ...base, email_account_name: '' }, 'GMail')).toBe(
			'Account name is required',
		)
	})

	it('requires an email id', () => {
		expect(validateInputs({ ...base, email_id: '' }, 'GMail')).toBe(
			'Email ID is required',
		)
	})

	it('rejects a malformed email id', () => {
		expect(validateInputs({ ...base, email_id: 'not-an-email' }, 'GMail')).toBe(
			'Invalid email ID',
		)
	})

	it('requires a password for non-Frappe-Mail when not allowed missing', () => {
		expect(validateInputs({ ...base, password: '' }, 'GMail')).toBe(
			'Password is required',
		)
	})

	it('allows a missing password on edit (allowMissingPassword)', () => {
		expect(validateInputs({ ...base, password: '' }, 'GMail', true)).toBe('')
	})

	it('requires api key + secret for Frappe Mail', () => {
		expect(validateInputs({ ...base, api_key: '' }, 'Frappe Mail')).toBe(
			'API Key is required',
		)
		expect(validateInputs({ ...base, api_secret: '' }, 'Frappe Mail')).toBe(
			'API Secret is required',
		)
	})

	it('Frappe Mail ignores the password requirement', () => {
		expect(validateInputs({ ...base, password: '' }, 'Frappe Mail')).toBe('')
	})
})
