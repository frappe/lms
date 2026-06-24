import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the heavy Plyr dependency — the guard only cares that the constructor
// runs once per element, not what the player does. The settings store is mocked
// too (the seek listener reads it); neither is exercised in this test.
const plyrCtor = vi.hoisted(() =>
	vi.fn(function FakePlyr(this: { on: () => void }) {
		this.on = () => {}
	})
)
vi.mock('plyr', () => ({ default: plyrCtor }))
vi.mock('plyr/dist/plyr.css', () => ({}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))

import { enablePlyr } from '@/utils/plyr'

describe('enablePlyr double-init guard', () => {
	beforeEach(() => {
		plyrCtor.mockClear()
		document.body.innerHTML = ''
	})

	it('initialises Plyr once per .video-player even when enablePlyr runs repeatedly', async () => {
		const el = document.createElement('div')
		el.className = 'video-player'
		el.setAttribute('src', 'dQw4w9WgXcQ')
		document.body.appendChild(el)

		const first = await enablePlyr()
		const second = await enablePlyr()

		// The second pass must reuse the instance, not stack a second player
		// (which is what produced the duplicate controls).
		expect(plyrCtor).toHaveBeenCalledTimes(1)
		expect(first).toHaveLength(1)
		expect(second).toHaveLength(1)
		expect(second[0]).toBe(first[0])
	})

	it('initialises each distinct .video-player exactly once', async () => {
		for (const id of ['aaa', 'bbb']) {
			const el = document.createElement('div')
			el.className = 'video-player'
			el.setAttribute('src', id)
			document.body.appendChild(el)
		}

		await enablePlyr()
		await enablePlyr()

		expect(plyrCtor).toHaveBeenCalledTimes(2)
	})
})
