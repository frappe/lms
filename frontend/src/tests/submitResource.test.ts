/**
 * The four paths through submitResource, each pinned against the real
 * createResource contract (frappe-ui resources.js lines 77-184):
 *
 *   - validate() blocks before any request goes out
 *   - a failed request is reported once and its rejection is swallowed
 *   - a throw from onSuccess is NOT reported to the user, but still surfaces
 *   - anything unreported still surfaces
 */
import { describe, expect, it, vi } from 'vitest'
import { resourceErrorMessage, submitResource } from '@/utils/resource'

// The default-parameter expression calls the frappe global.
vi.stubGlobal('__', (v: string) => v)

/**
 * Stands in for createResource.submit. Mirrors resources.js: success callbacks
 * run inside the same try whose catch calls onError and rethrows.
 */
const fakeResource = <T>(run: () => Promise<T>) => ({
	submit: async (_params: unknown, options: Record<string, unknown>) => {
		const onSuccess = options.onSuccess as ((data: T) => void) | undefined
		const onError = options.onError as ((error: unknown) => void) | undefined
		try {
			const data = await run()
			onSuccess?.(data)
			return data
		} catch (error) {
			onError?.(error)
			throw error
		}
	},
})

describe('submitResource', () => {
	it('blocks on validate without touching the resource', async () => {
		const run = vi.fn()
		const onError = vi.fn()
		const onSuccess = vi.fn()

		await submitResource(
			fakeResource(run as () => Promise<unknown>),
			{},
			{ validate: () => 'Title is required', onSuccess, onError }
		)

		expect(run).not.toHaveBeenCalled()
		expect(onSuccess).not.toHaveBeenCalled()
		// The raw message, not an Error — so callers never read .message back off
		// a wrapper and print browser text like "Failed to fetch" at the user.
		expect(onError).toHaveBeenCalledWith('Title is required')
	})

	it('passes params through and reports success', async () => {
		const run = vi.fn().mockResolvedValue({ name: 'chapter-1' })
		const onSuccess = vi.fn()

		await expect(
			submitResource(fakeResource(run), { title: 'Module 1' }, { onSuccess })
		).resolves.toBeUndefined()

		expect(onSuccess).toHaveBeenCalledWith({ name: 'chapter-1' })
	})

	it('swallows a failed request once onError has reported it', async () => {
		const failure = { messages: ['Chapter is locked'] }
		const onError = vi.fn()

		await expect(
			submitResource(
				fakeResource(() => Promise.reject(failure)),
				{},
				{ onError }
			)
		).resolves.toBeUndefined()

		expect(onError).toHaveBeenCalledWith(failure)
		expect(onError).toHaveBeenCalledTimes(1)
	})

	it('does not tell the user a saved record failed when onSuccess throws', async () => {
		const bug = new TypeError(
			"Cannot read properties of undefined (reading 'map')"
		)
		const onError = vi.fn()

		await expect(
			submitResource(
				fakeResource(() => Promise.resolve({ name: 'chapter-1' })),
				{},
				{
					onSuccess() {
						throw bug
					},
					onError,
				}
			)
		).rejects.toBe(bug)

		// The record WAS saved; reporting it as an error would be a lie, and it is
		// what made a moderator retry and create a duplicate chapter.
		expect(onError).not.toHaveBeenCalled()
	})

	it('awaits an async onSuccess, so a chained submit settles first', async () => {
		const order: string[] = []
		let releaseChained: () => void = () => {}
		const chained = new Promise<void>((resolve) => {
			releaseChained = resolve
		})

		const pending = submitResource(
			fakeResource(() => Promise.resolve('outer')),
			{},
			{
				async onSuccess() {
					order.push('chained:start')
					await chained
					order.push('chained:done')
				},
			}
		).then(() => order.push('returned'))

		await Promise.resolve()
		expect(order).toEqual(['chained:start'])

		releaseChained()
		await pending
		expect(order).toEqual(['chained:start', 'chained:done', 'returned'])
	})

	it('surfaces a rejection from an async onSuccess', async () => {
		const bug = new Error('chained submit blew up')

		await expect(
			submitResource(
				fakeResource(() => Promise.resolve('outer')),
				{},
				{
					async onSuccess() {
						throw bug
					},
				}
			)
		).rejects.toBe(bug)
	})

	it('rethrows a failure that never reached onError', async () => {
		const boom = new Error('resource exploded before reporting')

		await expect(
			submitResource({
				submit: () => Promise.reject(boom),
			})
		).rejects.toBe(boom)
	})
})

describe('resourceErrorMessage', () => {
	it('prefers a real server message', () => {
		expect(resourceErrorMessage({ messages: ['Quiz is locked'] })).toBe(
			'Quiz is locked'
		)
	})

	it('returns a validation string unchanged', () => {
		expect(resourceErrorMessage('Title is required')).toBe('Title is required')
	})

	// frappeRequest fills `messages` with this exact literal whenever the server
	// sent no _server_messages, so it is present on every bare PermissionError,
	// DoesNotExistError and 500. Treating it as a message made the fallback dead
	// code and put raw untranslated English in the toast.
	it('falls back when the only message is the generic server default', () => {
		expect(
			resourceErrorMessage({ messages: ['Internal Server Error'] }, 'Try again')
		).toBe('Try again')
	})

	it('falls back when there is no message at all', () => {
		expect(resourceErrorMessage({}, 'Try again')).toBe('Try again')
		expect(
			resourceErrorMessage(new TypeError('Failed to fetch'), 'Try again')
		).toBe('Try again')
	})
})
