/**
 * useSettingsListResource: the paging, search and delete contract behind every
 * settings list.
 *
 * The bugs pinned here are all frappe-ui's own, and all only reachable once a
 * list can page: reload() rewrites pageLength to the loaded row count when
 * start > 0; delete refetches with fetch(), which keeps that start and
 * concatenates; a cached resource comes back with the previous mount's filters
 * still on it; and nothing sequences responses, so whichever lands last wins
 * regardless of what it was asked for.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

const { fetches, cache, deferred, methodCalls, methodDeferred } = vi.hoisted(
	() => ({
		fetches: [] as any[],
		cache: new Map<string, any>(),
		deferred: [] as Array<() => void>,
		methodCalls: [] as any[],
		methodDeferred: [] as Array<(rows: any[] | null) => void>,
	})
)

vi.mock('frappe-ui', () => ({
	// useSettingsMethodResource's resource: one call per reload(), with no
	// caching and no built-in sequencing of its own. The token guard that
	// gives it sequencing lives in the composable, not here.
	createResource: (options: any) => ({
		reload: () => {
			methodCalls.push(options.makeParams())
			return new Promise((resolve) => methodDeferred.push(resolve))
		},
	}),
	createListResource: (options: any) => {
		const key = Array.isArray(options.cache)
			? options.cache.join(':')
			: options.cache
		if (key && cache.has(key)) return cache.get(key)

		const record = () =>
			fetches.push({
				start: out.start,
				pageLength: out.pageLength,
				orFilters: out.orFilters,
				filters: out.filters,
			})

		// Responses resolve only when the test drains them, and each writes the
		// query it was issued for into `data`, so a test can hold two requests
		// open, land them in either order, and see which one won.
		const settle = () => {
			const issuedFor = {
				start: out.start,
				orFilters: out.orFilters,
			}
			return new Promise<any>((resolve) => {
				deferred.push(() => {
					out.data = [{ servedFor: issuedFor }]
					resolve(out.data)
				})
			})
		}

		const out: any = {
			data: [],
			start: 0,
			pageLength: options.pageLength || 20,
			orFilters: options.orFilters,
			filters: options.filters,
			hasNextPage: true,
			list: {
				loading: false,
				fetch() {
					record()
					return settle()
				},
			},
			update(next: any) {
				Object.assign(out, next)
			},
			reload() {
				const start = out.start
				const pageLength = out.pageLength
				if (out.start > 0) {
					out.start = 0
					out.pageLength = out.data.length
				}
				record()
				out.start = start
				out.pageLength = pageLength
				return settle()
			},
			delete: {
				submit(name: string, callbacks: any) {
					out.deleted = name
					// frappe-ui's delete resource refetches from its OWN onSuccess
					// (listResource.js:161), before any per-call onSuccess runs. The
					// stub left this out, so the overlapping request went unnoticed.
					out.list.fetch()
					callbacks?.onSuccess?.()
				},
			},
		}
		if (key) cache.set(key, out)
		return out
	},
}))

import {
	SETTINGS_PAGE_LENGTH,
	useSettingsListResource,
	useSettingsMethodResource,
} from '@/composables/useSettingsListResource'

/** Advances microtasks so a queued request is issued, without landing it. */
const issue = async (times = 6) => {
	for (let i = 0; i < times; i++) await Promise.resolve()
}

/** Resolves every queued response so the serialised chain can drain. */
const drain = async () => {
	for (let i = 0; i < 8; i++) {
		deferred.splice(0).forEach((resolve) => resolve())
		await nextTick()
		await Promise.resolve()
	}
}

const build = (overrides: Record<string, any> = {}) =>
	useSettingsListResource({
		doctype: 'LMS Coupon',
		fields: ['name', 'code'],
		searchFields: ['code', 'description'],
		...overrides,
	})

beforeEach(() => {
	fetches.length = 0
	deferred.length = 0
	cache.clear()
	methodCalls.length = 0
	methodDeferred.length = 0
})

/** Lands the oldest outstanding method-resource call with `rows`. */
const landMethod = async (rows: any[] | null) => {
	methodDeferred.shift()?.(rows)
	await Promise.resolve()
	await Promise.resolve()
}

describe('useSettingsListResource', () => {
	it('pages at 13 rows', async () => {
		expect(SETTINGS_PAGE_LENGTH).toBe(13)
		const list = build()
		await drain()

		expect(list.resource.pageLength).toBe(13)
	})

	it('sends a search to the server as an OR over every search field', async () => {
		const list = build()
		await drain()

		list.search = 'SAVE20'
		await nextTick()
		await drain()

		expect(fetches.at(-1).orFilters).toEqual([
			['code', 'like', '%SAVE20%'],
			['description', 'like', '%SAVE20%'],
		])
	})

	it('clears the filters again when the search is emptied', async () => {
		const list = build()
		await drain()

		list.search = 'SAVE20'
		await nextTick()
		await drain()
		list.search = ''
		await nextTick()
		await drain()

		expect(fetches.at(-1).orFilters).toEqual([])
	})

	it('searches from the first page after Load More, not the loaded range', async () => {
		const list = build()
		await drain()
		list.resource.data = new Array(13).fill({})

		list.loadMore()
		await drain()
		expect(fetches.at(-1).start).toBe(13)

		list.resource.data = new Array(26).fill({})
		list.search = 'SAVE20'
		await nextTick()
		await drain()

		// Without the reset this asks for 26 rows starting at 0: the loaded
		// range, which is what makes a match on row 40 unreachable.
		expect(fetches.at(-1)).toMatchObject({ start: 0, pageLength: 13 })
		expect(list.resource.start).toBe(0)
	})

	it('resets to the first page when a filter changes too', async () => {
		const list = build()
		await drain()
		list.resource.data = new Array(13).fill({})
		list.loadMore()
		await drain()

		list.applyFilters([['payment_received', '=', 1]])
		await drain()

		expect(fetches.at(-1)).toMatchObject({ start: 0, pageLength: 13 })
	})

	it('never filters rows in the client', async () => {
		const list = build()
		await drain()
		const rows = [{ code: 'SAVE20' }, { code: 'FREE' }]
		list.resource.data = rows

		list.search = 'SAVE20'
		await nextTick()
		await issue()

		// The term went to the server and the composable left the rows it was
		// holding alone; only the response replaces them.
		expect(fetches.at(-1).orFilters).toEqual([
			['code', 'like', '%SAVE20%'],
			['description', 'like', '%SAVE20%'],
		])
		expect(list.rows).toEqual(rows)
	})

	it('refetches from the first page after a delete', async () => {
		const list = build()
		await drain()
		list.resource.data = new Array(13).fill({})
		list.loadMore()
		await drain()
		expect(list.resource.start).toBe(13)

		list.resource.data = new Array(26).fill({})
		list.remove('SAVE20')
		await drain()

		// frappe-ui's own post-delete refetch keeps start, so page two gets
		// concatenated onto the rows already shown and the deleted row stays.
		expect(list.resource.start).toBe(0)
		expect(fetches.at(-1)).toMatchObject({ start: 0, pageLength: 13 })
	})

	it('asks for no page but the first once a delete has been issued', async () => {
		const list = build()
		await drain()
		list.resource.data = new Array(13).fill({})
		list.loadMore()
		await drain()
		expect(list.resource.start).toBe(13)

		list.resource.data = new Array(26).fill({})
		const before = fetches.length
		list.remove('SAVE20')
		await drain()

		// Rewinding to page one AFTER frappe-ui's refetch has fired does not help:
		// list.onSuccess reads `start` when the response LANDS, so the in-flight
		// start=13 request takes the replace branch and renders rows 14-26 as page one.
		expect(fetches.slice(before).map((fetch: any) => fetch.start)).toEqual(
			fetches.slice(before).map(() => 0)
		)
	})

	it('does not skip the page a failed Load More asked for', async () => {
		const list = build()
		await drain()
		list.resource.data = new Array(13).fill({})
		list.loadMore()
		await drain()
		expect(list.resource.start).toBe(13)

		const original = list.resource.list.fetch
		list.resource.list.fetch = () => Promise.reject(new Error('offline'))
		await list.loadMore()
		list.resource.list.fetch = original

		// Back to the last page that actually landed. Left at 26, the next Load
		// More would ask for 39 and rows 26-38 would never be fetched.
		expect(list.resource.start).toBe(13)

		const before = fetches.length
		list.loadMore()
		await drain()
		expect(fetches.slice(before).map((fetch: any) => fetch.start)).toEqual([26])
	})

	it('reports a delete failure to the caller instead of swallowing it', async () => {
		const list = build()
		await drain()
		const onError = vi.fn()
		list.resource.delete.submit = (_name: string, callbacks: any) =>
			callbacks.onError({ messages: ['LinkExistsError'] })

		list.remove('SAVE20', { onError })
		await drain()

		expect(onError).toHaveBeenCalledWith({ messages: ['LinkExistsError'] })
	})

	it('drops the search a cached resource still carries from its last mount', async () => {
		const first = build({ cache: ['coupons'] })
		await drain()
		first.search = 'SAVE20'
		await nextTick()
		await drain()
		expect(first.resource.orFilters).not.toEqual([])

		// Reopening the panel gets the same cached resource back, and
		// createListResource returns it before applying any option, so the box
		// renders empty over a list that is still filtered.
		const second = build({ cache: ['coupons'] })
		await drain()

		expect(second.resource).toBe(first.resource)
		expect(second.search).toBe('')
		expect(second.resource.orFilters).toEqual([])
		expect(fetches.at(-1).orFilters).toEqual([])
	})

	it('never holds two queries in flight at once', async () => {
		const list = build()
		await drain()
		list.resource.data = new Array(13).fill({})

		list.loadMore()
		list.search = 'SAVE20'
		await nextTick()
		await issue()

		// Only the Load More is out. Holding the search back is the whole
		// guarantee: with both in flight, frappe-ui sequences nothing, so the
		// page-two response can land last and leave unfiltered rows under a
		// search term.
		expect(deferred).toHaveLength(1)
		expect(fetches.at(-1).start).toBe(13)

		await drain()

		expect(list.rows[0].servedFor).toEqual({
			start: 0,
			orFilters: [
				['code', 'like', '%SAVE20%'],
				['description', 'like', '%SAVE20%'],
			],
		})
	})
})

/**
 * useSettingsMethodResource: the same contract as above, for the one list
 * (Settings > Users, via get_members) that pages a whitelisted method.
 * createResource has none of createListResource's paging or sequencing, so all three are hand-rolled here.
 */
describe('useSettingsMethodResource', () => {
	it('resets to the first page and refetches when the search changes', async () => {
		const list = useSettingsMethodResource({
			method: 'lms.lms.api.get_members',
			doctype: 'User',
		})
		expect(methodCalls.at(-1)).toMatchObject({ search: '', start: 0 })
		await landMethod(new Array(13).fill({ name: 'old' }))
		expect(list.rows).toHaveLength(13)

		list.search = 'ada'
		await Promise.resolve()
		await Promise.resolve()

		expect(methodCalls.at(-1)).toMatchObject({ search: 'ada', start: 0 })
		await landMethod([{ name: 'ada@example.com' }])

		// Replaced, not appended to: the old page is gone the moment the
		// search reload lands, not once a second page would have arrived.
		expect(list.rows).toEqual([{ name: 'ada@example.com' }])
	})

	it('drops a response superseded by a newer request', async () => {
		const list = useSettingsMethodResource({
			method: 'lms.lms.api.get_members',
			doctype: 'User',
		})

		// The construction-time auto reload is still in flight when the search
		// changes underneath it, leaving two calls outstanding.
		list.search = 'first'
		await Promise.resolve()
		await Promise.resolve()
		expect(methodCalls).toHaveLength(2)

		await landMethod([{ name: 'stale' }])
		expect(list.rows).toEqual([])

		await landMethod([{ name: 'fresh' }])
		expect(list.rows).toEqual([{ name: 'fresh' }])
	})

	it('flags hasNextPage from what the server actually returned', async () => {
		const list = useSettingsMethodResource({
			method: 'lms.lms.api.get_members',
			doctype: 'User',
			pageLength: 5,
		})
		await landMethod(new Array(5).fill({}))
		expect(list.hasNextPage).toBe(true)

		list.loadMore()
		await landMethod(new Array(2).fill({}))

		expect(list.rows).toHaveLength(7)
		expect(list.hasNextPage).toBe(false)
	})
})
