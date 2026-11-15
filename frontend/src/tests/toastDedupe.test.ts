import { describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({ toast: {} }))

import { dedupeToasts } from '@/utils/toastDedupe'

const makeTarget = () => ({
	success: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
	info: vi.fn(),
})

describe('dedupeToasts', () => {
	it('gives the same message the same id, so it replaces the one on screen', () => {
		const target = makeTarget()
		const { error } = target
		dedupeToasts(target)

		target.error('Could not save')
		target.error('Could not save')

		expect(error.mock.calls[0][1].id).toBe('error:Could not save')
		expect(error.mock.calls[1][1].id).toBe('error:Could not save')
	})

	it('keeps different messages and types apart', () => {
		const target = makeTarget()
		const { success, warning } = target
		dedupeToasts(target)

		target.success('Saved')
		target.warning('Saved')
		target.success('Sent')

		expect(success.mock.calls.map((call) => call[1].id)).toEqual([
			'success:Saved',
			'success:Sent',
		])
		expect(warning.mock.calls[0][1].id).toBe('warning:Saved')
	})

	it("keeps a caller's own id and options", () => {
		const target = makeTarget()
		const { info } = target
		dedupeToasts(target)

		target.info('Uploading', { id: 'upload', duration: 1000 })

		expect(info).toHaveBeenCalledWith('Uploading', {
			id: 'upload',
			duration: 1000,
		})
	})

	it('leaves a non-text message without an id', () => {
		const target = makeTarget()
		const { error } = target
		dedupeToasts(target)
		const err = new Error('boom')

		target.error(err)

		expect(error).toHaveBeenCalledWith(err, {})
	})
})
