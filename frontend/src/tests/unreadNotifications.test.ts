/**
 * The unread notification count.
 *
 * It used to be a component-local ref in AppSidebar fed by a resource carrying
 * `cache: 'Unread Notifications Count'`. That is the shape behind bbf030fc5 and
 * 1298a0dae: createResource hands back the FIRST instance for a cache key and
 * never rebinds its onSuccess, so a remounted sidebar's ref sits at zero
 * forever while the cached resource writes into the unmounted one. The same key
 * was also how `markAsRead` reached the count — via `getCachedResource`, which
 * on a phone found nothing at all, because AppSidebar is never mounted there.
 *
 * So the guard that matters most here is the absence of a cache key. The rest
 * pins that the count is the same number wherever it is read from.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface ResourceOptions {
	url?: string
	cache?: unknown
	makeParams?: (values?: unknown) => unknown
	onSuccess?: (data?: unknown) => void
	auto?: boolean
	reload: ReturnType<typeof vi.fn>
}

const { createResource, createListResource, session } = vi.hoisted(() => {
	const make = (options: Record<string, unknown>) => ({
		...options,
		reload: vi.fn(),
		submit: vi.fn(),
	})
	return {
		createResource: vi.fn(make),
		createListResource: vi.fn(make),
		session: { user: 'raiza@example.com' },
	}
})

vi.mock('frappe-ui', () => ({ createResource, createListResource }))
vi.mock('@/stores/session', () => ({ sessionStore: () => session }))

import {
	loadUnreadCount,
	markAllAsRead,
	markAsRead,
	notifications,
	unreadCount,
	unreadNotifications,
} from '@/stores/notifications'

const resource = unreadNotifications as unknown as ResourceOptions

beforeEach(() => {
	vi.clearAllMocks()
	session.user = 'raiza@example.com'
	unreadCount.value = 0
})

describe('the count resource', () => {
	it('carries no cache key', () => {
		// The whole reason this moved out of AppSidebar. A cache key here would
		// hand every later caller the first instance's closures.
		expect(resource.cache).toBeUndefined()
	})

	it('counts only the signed-in user unread logs', () => {
		expect(resource.makeParams?.()).toEqual({
			doctype: 'Notification Log',
			filters: { for_user: 'raiza@example.com', read: 0 },
		})
	})

	it('asks who the user is at request time, not at import time', () => {
		// Module-level, so the store is imported before pinia is even active;
		// reading the session inside makeParams is what keeps that legal.
		session.user = 'someone@else.com'
		expect(resource.makeParams?.()).toMatchObject({
			filters: { for_user: 'someone@else.com', read: 0 },
		})
	})

	it('does not fetch on its own', () => {
		expect(resource.auto).toBe(false)
	})

	it('publishes the count it was given', () => {
		resource.onSuccess?.(12)
		expect(unreadCount.value).toBe(12)
	})

	it('reads an empty answer as none rather than nothing', () => {
		unreadCount.value = 5
		resource.onSuccess?.(undefined)
		expect(unreadCount.value).toBe(0)
	})
})

describe('loadUnreadCount', () => {
	it('fetches for a signed-in user', () => {
		loadUnreadCount()
		expect(resource.reload).toHaveBeenCalledTimes(1)
	})

	it('does nothing for a signed-out visitor', () => {
		session.user = null as unknown as string
		loadUnreadCount()
		expect(resource.reload).not.toHaveBeenCalled()
	})
})

describe('marking as read', () => {
	const list = notifications as unknown as ResourceOptions

	it('refreshes both the list and the count', () => {
		;(markAsRead as unknown as ResourceOptions).onSuccess?.()
		expect(list.reload).toHaveBeenCalledTimes(1)
		expect(resource.reload).toHaveBeenCalledTimes(1)
	})

	it('does the same when everything is marked at once', () => {
		;(markAllAsRead as unknown as ResourceOptions).onSuccess?.()
		expect(list.reload).toHaveBeenCalledTimes(1)
		expect(resource.reload).toHaveBeenCalledTimes(1)
	})

	it('does not ask for a count a signed-out visitor cannot have', () => {
		session.user = null as unknown as string
		;(markAsRead as unknown as ResourceOptions).onSuccess?.()
		expect(resource.reload).not.toHaveBeenCalled()
	})
})
