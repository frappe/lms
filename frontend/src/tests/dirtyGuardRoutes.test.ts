/**
 * The settings dirty guard lets a query change through without asking, and
 * asks for anything that leaves the form.
 */
import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { installDirtyGuard, useDirtyGuard } from '@/composables/useDirtyGuard'

type Guard = (to: unknown, from: unknown) => Promise<boolean>

const route = (path: string, hash: string) => ({ path, hash })

const setup = () => {
	let guard: Guard | null = null
	const router = {
		beforeEach: (fn: Guard) => {
			guard = fn
			return () => {}
		},
	}
	const confirm = vi.fn(async () => false)
	installDirtyGuard(router as never, confirm)
	const scope = effectScope()
	scope.run(() => useDirtyGuard(() => true))
	return { guard: () => guard!, confirm, stop: () => scope.stop() }
}

describe('the settings dirty guard', () => {
	it('lets a query change on the same page through', async () => {
		const { guard, confirm, stop } = setup()
		const here = route('/courses', '#settings/general')
		expect(await guard()(here, here)).toBe(true)
		expect(confirm).not.toHaveBeenCalled()
		stop()
	})

	it('asks before another page under the same hash', async () => {
		const { guard, confirm, stop } = setup()
		const result = await guard()(
			route('/batches', '#settings/general'),
			route('/courses', '#settings/general'),
		)
		expect(confirm).toHaveBeenCalledTimes(1)
		expect(result).toBe(false)
		stop()
	})
})
