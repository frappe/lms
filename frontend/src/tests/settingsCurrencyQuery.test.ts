import { describe, expect, it, vi } from 'vitest'
// Only the field data matters here, not the settings pages.
vi.mock('@/components/Settings/Members.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/Categories.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/EmailTemplate/EmailTemplatePage.vue', () => ({
	default: {},
}))
vi.mock('@/components/Settings/EmailAccount/EmailConfig.vue', () => ({
	default: {},
}))
vi.mock('@/components/Settings/BrandSettings.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/PaymentGateways.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/Coupons/Coupons.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/Transactions/Transactions.vue', () => ({
	default: {},
}))
vi.mock('@/components/Settings/ZoomSettings.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/GoogleMeetSettings.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/Badges/Badges.vue', () => ({ default: {} }))
vi.mock('@/components/Settings/Raven/RavenSettings.vue', () => ({
	default: {},
}))

import { settingsStructure } from '@/components/Settings/settingsStructure.js'

const fieldsOf = (node: any): any[] => [
	...(node.fields ?? []),
	...['items', 'sections', 'columns'].flatMap((key) =>
		(node[key] ?? []).flatMap(fieldsOf),
	),
]

describe('the settings tree', () => {
	// Regression: currency picker 403 for LMS roles (#3023, fixed in #3038).
	it('searches every Currency link through the LMS query', () => {
		const currencyLinks = settingsStructure
			.flatMap(fieldsOf)
			.filter((field) => field.type === 'Link' && field.doctype === 'Currency')

		expect(currencyLinks).not.toHaveLength(0)
		for (const field of currencyLinks) {
			expect(field).toHaveProperty('query', 'lms.lms.api.search_currencies')
		}
	})
})
