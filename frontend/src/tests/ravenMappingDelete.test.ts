/**
 * confirmDelete() re-entrancy guard: a duplicate `confirm` fired two concurrent
 * delete_* requests, colliding on delete_doc's NOWAIT lock → QueryTimeoutError.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { useMappingList } from '@/composables/raven/useMappingList'

const h = vi.hoisted(() => ({
	resources: [] as any[],
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	toast: h.toast,
	createResource: (config: any) => {
		const url = String(config.url)
		const res: any = reactive({
			url,
			params: config.params,
			loading: false,
			data: null,
			error: null,
		})
		res.reset = vi.fn(() => {
			res.data = null
		})
		res.reload = vi.fn(async () => res.data)
		res.submit = vi.fn((payload: any) => {
			res.lastPayload = payload
			res.submitCount = (res.submitCount ?? 0) + 1
			// Mirror real frappe-ui: loading flips true synchronously, before any
			// await, and only flips back once the fetch resolves.
			res.loading = true
			return new Promise((resolve) => {
				res._resolve = () => {
					res.loading = false
					config.onSuccess?.(payload)
					resolve(payload)
				}
			})
		})
		h.resources.push(res)
		return res
	},
}))

vi.stubGlobal('__', (s: string) => s)

const res = (fragment: string) =>
	h.resources.find((r) => r.url.includes(fragment))

const mappedChannel = () => ({
	name: 'RCM-1',
	mapped: true,
	raven_channel: 'CH-1',
	channel_label: 'general',
	workspace: 'RWM-parent',
	channel_type: 'Public',
	rule_combinator: 'Any (OR)',
	enabled: 1,
	stale: 0,
})

async function channelList(records: any[]) {
	const list = useMappingList({ entity: 'channel', workspace: 'RWM-parent' })
	res('list_channels').data = records
	await nextTick()
	return list
}

beforeEach(() => {
	h.resources = []
	h.toast.success.mockReset()
	h.toast.error.mockReset()
})

describe('useMappingList — confirmDelete re-entrancy guard', () => {
	it('submits exactly once when confirmDelete is called twice before the first submit resolves', async () => {
		const list = await channelList([mappedChannel()])
		const row = list.rows.value[0]

		list.askDelete(row)
		expect(list.deleteOpen.value).toBe(true)

		// Two synchronous confirms, back to back, before the in-flight submit's
		// promise resolves — the double-submit shape from the bug report.
		list.confirmDelete()
		list.confirmDelete()

		const deleteRes = res('delete_channel')
		expect(deleteRes.submit).toHaveBeenCalledTimes(1)
		expect(deleteRes.submit).toHaveBeenCalledWith({ name: 'RCM-1' })
		expect(list.deleting.value).toBe(true)

		deleteRes._resolve()
		await flushPromises()

		expect(deleteRes.submit).toHaveBeenCalledTimes(1)
		expect(list.deleteOpen.value).toBe(false)
	})

	it('allows a fresh confirmDelete after the previous delete has resolved', async () => {
		const list = await channelList([mappedChannel()])
		const row = list.rows.value[0]

		list.askDelete(row)
		list.confirmDelete()
		const deleteRes = res('delete_channel')
		expect(deleteRes.submit).toHaveBeenCalledTimes(1)

		deleteRes._resolve()
		await flushPromises()

		// A brand new delete (e.g. a different row) is not blocked by the guard
		// once the in-flight one has settled.
		list.askDelete(row)
		list.confirmDelete()
		expect(deleteRes.submit).toHaveBeenCalledTimes(2)
		deleteRes._resolve()
		await flushPromises()
	})

	it('does nothing if confirmDelete is called with no row staged', async () => {
		const list = await channelList([mappedChannel()])
		list.confirmDelete()
		expect(res('delete_channel').submit).not.toHaveBeenCalled()
	})
})
