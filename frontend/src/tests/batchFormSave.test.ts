import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('__', (text: string) => text)

import { batchFormPayload, validateBatch } from '@/utils/batchForm'
import type { LMSBatch } from '@/types/lms/LMSBatch'

const complete = {
	title: 'Batch',
	start_date: '2026-10-20',
	end_date: '2026-10-30',
	start_time: '10:00',
	end_time: '11:00',
	timezone: 'Asia/Kolkata',
	description: 'Short',
	batch_details: '<p>Details</p>',
	paid_batch: 0,
	amount: 0,
	currency: '',
}

const validate = (extra: Record<string, unknown>) =>
	validateBatch({
		doc: { ...complete, ...extra } as Parameters<
			typeof validateBatch
		>[0]['doc'],
		instructors: ['a@example.com'],
	})

describe('validateBatch conferencing', () => {
	// Guards: picking a meeting tool before its account, which sent an autosave
	// the server rejects about once a second. Reached from onboarding's "Add the
	// account to the batch" (feat/onboarding-flows, PR pending); test added there.
	it('holds a tool without its account, with the server message', () => {
		expect(validate({ conferencing_provider: 'Zoom' })).toBe(
			'Please select a Zoom account for this batch.'
		)
		expect(validate({ conferencing_provider: 'Google Meet' })).toBe(
			'Please select a Google Meet account for this batch.'
		)
	})

	it('saves once the account is picked, or with no tool', () => {
		expect(
			validate({ conferencing_provider: 'Zoom', zoom_account: 'Demo' })
		).toBeNull()
		expect(
			validate({
				conferencing_provider: 'Google Meet',
				google_meet_account: 'Demo',
			})
		).toBeNull()
		expect(validate({ conferencing_provider: '' })).toBeNull()
	})
})

describe('batchFormPayload', () => {
	// Guards: the batch settings autosave deleting the courses and assessments
	// added through their own forms since the page loaded, or unpublishing a
	// batch published from the header (onboarding adds both, publishes, then
	// the conferencing step autosaves the batch). Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there.
	it('leaves out what other forms write, keeps its own fields', () => {
		const doc = {
			...complete,
			name: 'B1',
			zoom_account: 'Demo',
			courses: [],
			assessment: [],
			timetable: [],
			timetable_legends: [],
			instructors: [],
			published: false,
		} as unknown as LMSBatch
		const payload = batchFormPayload(doc, ['a@example.com'])
		for (const table of [
			'courses',
			'assessment',
			'timetable',
			'timetable_legends',
			'published',
		])
			expect(payload).not.toHaveProperty(table)
		expect(payload).toMatchObject({
			title: 'Batch',
			zoom_account: 'Demo',
			instructors: [{ instructor: 'a@example.com' }],
		})
	})
})
