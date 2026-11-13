import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({ toast: { error: vi.fn() } }))

import { exportCourseAsZip } from '@/utils/exportCourse'

// The export was sent as GET since 75ed9c5ec, which the POST-only endpoint refuses.
// Added with the POST-only change for audit findings #27/#28 (fix/mutations-post-only).
describe('exportCourseAsZip', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock)
		window.csrf_token = 'token-123'
		window.URL.createObjectURL = vi.fn(() => 'blob:zip')
		window.URL.revokeObjectURL = vi.fn()
		fetchMock.mockResolvedValue(
			new Response(new Blob(['zip']), {
				headers: { 'Content-Disposition': 'attachment; filename="c.zip"' },
			})
		)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		fetchMock.mockReset()
	})

	it('posts the course name with the CSRF token', async () => {
		await exportCourseAsZip('my-course')

		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('/api/method/lms.lms.api.export_course_as_zip')
		expect(init.method).toBe('POST')
		expect(init.headers['X-Frappe-CSRF-Token']).toBe('token-123')
		expect(new URLSearchParams(init.body).get('course_name')).toBe('my-course')
	})
})
