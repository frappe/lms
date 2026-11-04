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
		(node[key] ?? []).flatMap(fieldsOf)
	),
]

const fieldNamed = (name: string) =>
	settingsStructure.flatMap(fieldsOf).find((field) => field.name === name)

describe('the lesson completion settings', () => {
	it.each([
		'enforce_quiz_passing',
		'enforce_open_ended_quiz_passing',
		'enforce_assignment_passing',
	])('offers %s as a switch', (name) => {
		expect(fieldNamed(name)?.type).toBe('checkbox')
	})

	// Learners can't save an exercise on this branch, so turning these on would
	// leave every lesson with an exercise incomplete for good.
	it.each([
		'enforce_programming_exercise_completion',
		'enforce_programming_exercise_passing',
	])('does not offer %s', (name) => {
		expect(fieldNamed(name)).toBeUndefined()
	})

	// An unsaved checkbox loads empty and is seeded from `default`, so without it
	// the first save on this page would turn quiz passing off.
	it.each(['enforce_quiz_passing', 'enforce_open_ended_quiz_passing'])(
		'keeps %s on until an admin turns it off',
		(name) => {
			expect(fieldNamed(name)?.default).toBe(1)
		}
	)

	it.each(['enforce_video_completion', 'prevent_skipping_videos'])(
		'%s names the providers it cannot enforce',
		(name) => {
			for (const provider of ['Cloudflare Stream', 'Google Drive', 'Aparat'])
				expect(fieldNamed(name)?.description).toContain(provider)
		}
	)
})
