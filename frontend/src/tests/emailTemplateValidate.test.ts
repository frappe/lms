/**
 * Settings > Email Template validates before Save, since Save renames the
 * template before it writes the rest.
 */
import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('__', (text: string) => text)
vi.mock('@/components/Settings/rowActions', () => ({
	deleteRow: () => () => {},
}))
vi.mock('@/components/Settings/recordForm', () => ({
	recordForm: (options: unknown) => ({
		forNew: () => options,
		forRecord: () => options,
	}),
}))

import {
	emailTemplateSettingsPage,
	validateTemplate,
} from '@/components/Settings/EmailTemplate/emailTemplate'

const template = (over: Record<string, unknown> = {}) => ({
	name: 'Welcome',
	subject: 'Hello',
	use_html: 0,
	response: '<p>Hi</p>',
	response_html: '',
	...over,
})

describe('the email template form', () => {
	it('hands its check to the record form', () => {
		const detail = emailTemplateSettingsPage.rowDetail as { validate?: unknown }
		expect(detail.validate).toBe(validateTemplate)
	})

	it('passes a complete template', () => {
		expect(validateTemplate(template())).toBe('')
		expect(
			validateTemplate(
				template({ use_html: 1, response: '', response_html: '<b>x</b>' }),
			),
		).toBe('')
	})

	it.each([
		['Name', { name: '' }],
		['Subject', { subject: '' }],
		['Content', { response: '' }],
		['Content', { use_html: 1, response_html: '' }],
		['Name', { name: '   ' }],
		['Subject', { subject: ' ' }],
		['Content', { response: '\n ' }],
	])('refuses a template with no %s', (field, over) => {
		expect(validateTemplate(template(over))).toBe(`${field} is required`)
	})
})
