import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
	invalidatePermissions,
	usePermissions,
} from '../composables/usePermissions'

describe('usePermissions', () => {
	it('denies every ptype until an answer has arrived', () => {
		const { can, loading } = usePermissions('LMS Course', ref('c1'), {
			fetcher: vi.fn(() => new Promise<never>(() => {})),
		})
		expect(loading.value).toBe(true)
		expect(can('write')).toBe(false)
	})

	it('denies for Guest without issuing a request', async () => {
		const fetch = vi.fn()
		const { can } = usePermissions('LMS Course', ref('c2'), {
			user: null,
			fetcher: fetch,
		})
		expect(can('read')).toBe(false)
		expect(fetch).not.toHaveBeenCalled()
	})

	it('denies write in Student View even when the server permits it', async () => {
		const { can } = usePermissions('LMS Course', ref('c3'), {
			studentView: true,
			seed: { read: 1, write: 1 },
		})
		expect(can('read')).toBe(true)
		expect(can('write')).toBe(false)
	})

	it('drops the cached entry on invalidate', async () => {
		const { can } = usePermissions('LMS Course', ref('c4'), {
			seed: { write: 1 },
			fetcher: vi.fn(() => new Promise<never>(() => {})),
		})
		expect(can('write')).toBe(true)
		invalidatePermissions('LMS Course', 'c4')
		expect(can('write')).toBe(false)
	})

	it('asks the server once for a name several callers share', async () => {
		const fetcher = vi.fn(async () => ({ c5: { read: 1, write: 1 } }))
		const first = usePermissions('LMS Course', ref('c5'), { fetcher })
		const second = usePermissions('LMS Course', ref('c5'), { fetcher })
		await vi.waitFor(() => expect(first.loading.value).toBe(false))
		expect(fetcher).toHaveBeenCalledTimes(1)
		expect(second.can('write')).toBe(true)
	})

	it('batches the names asked for in the same tick into one call', async () => {
		const fetcher = vi.fn(async (_doctype: string, names: string[]) =>
			Object.fromEntries(names.map((n) => [n, { read: 1 }]))
		)
		const a = usePermissions('Course Lesson', ref('l1'), { fetcher })
		const b = usePermissions('Course Lesson', ref('l2'), { fetcher })
		await vi.waitFor(() => expect(a.loading.value).toBe(false))
		expect(fetcher).toHaveBeenCalledTimes(1)
		expect(fetcher.mock.calls[0][1].sort()).toEqual(['l1', 'l2'])
		expect(b.can('read')).toBe(true)
	})

	it('denies when the request fails rather than throwing', async () => {
		const fetcher = vi.fn(async () => {
			throw new Error('network')
		})
		const { can, loading } = usePermissions('LMS Course', ref('c6'), {
			fetcher,
		})
		await vi.waitFor(() => expect(loading.value).toBe(false))
		expect(can('read')).toBe(false)
	})

	it('re-asks when the name changes', async () => {
		const fetcher = vi.fn(async (_doctype: string, names: string[]) =>
			Object.fromEntries(names.map((n) => [n, { read: 1 }]))
		)
		const name = ref('c7')
		const { can, loading } = usePermissions('LMS Course', name, { fetcher })
		await vi.waitFor(() => expect(loading.value).toBe(false))
		expect(can('read')).toBe(true)

		name.value = 'c8'
		expect(can('read')).toBe(false)
		await vi.waitFor(() => expect(loading.value).toBe(false))
		expect(can('read')).toBe(true)
		expect(fetcher).toHaveBeenCalledTimes(2)
	})
})
