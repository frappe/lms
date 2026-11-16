// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

const call = vi.hoisted(() => vi.fn())
vi.mock('frappe-ui', () => ({ call }))

import { useCanWrite } from '@/composables/useCanWrite'

describe('useCanWrite', () => {
	it('asks the server for write on the named document', async () => {
		call.mockResolvedValueOnce({ has_permission: true })
		const canWrite = useCanWrite('LMS Quiz', () => 'QZ-1')
		expect(canWrite.value).toBeNull()
		await flushPromises()
		expect(call).toHaveBeenCalledWith('frappe.client.has_permission', {
			doctype: 'LMS Quiz',
			docname: 'QZ-1',
			perm_type: 'write',
		})
		expect(canWrite.value).toBe(true)
	})

	it('answers false for a non-author and for a failed request', async () => {
		call.mockResolvedValueOnce({ has_permission: false })
		const refused = useCanWrite('LMS Quiz', () => 'QZ-2')
		call.mockRejectedValueOnce(new Error('offline'))
		const failed = useCanWrite('LMS Quiz', () => 'QZ-3')
		await flushPromises()
		expect(refused.value).toBe(false)
		expect(failed.value).toBe(false)
	})

	it('treats a document being created as writable without asking', async () => {
		call.mockClear()
		const canWrite = useCanWrite('LMS Quiz', () => undefined)
		await flushPromises()
		expect(canWrite.value).toBe(true)
		expect(call).not.toHaveBeenCalled()
	})

	it('keeps only the answer for the current document', async () => {
		let releaseFirst: (value: unknown) => void = () => {}
		call.mockImplementationOnce(
			() => new Promise((resolve) => (releaseFirst = resolve))
		)
		call.mockResolvedValueOnce({ has_permission: false })
		const name = ref('QZ-A')
		const canWrite = useCanWrite('LMS Quiz', name)
		name.value = 'QZ-B'
		await flushPromises()
		releaseFirst({ has_permission: true })
		await flushPromises()
		expect(canWrite.value).toBe(false)
	})
})
