import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'

type Handler = () => void
type FakePlayer = {
	on: (event: string, handler: Handler) => void
	emit: (event: string) => void
	currentTime: number
}

// Mock the heavy Plyr dependency. The fake keeps Plyr's event surface so the
// skip guard can be driven the way Plyr's keyboard shortcuts drive it: by
// assigning currentTime, which fires `seeking` and never the progress input.
const plyrCtor = vi.hoisted(() =>
	vi.fn(function FakePlyr(this: FakePlayer) {
		const handlers: Record<string, Handler[]> = {}
		let time = 0
		this.on = (event, handler) => {
			;(handlers[event] ??= []).push(handler)
		}
		this.emit = (event) => handlers[event]?.forEach((handler) => handler())
		Object.defineProperty(this, 'currentTime', {
			get: () => time,
			set: (seconds: number) => {
				time = seconds
				this.emit('seeking')
			},
		})
	})
)
const settings = vi.hoisted(() => ({ data: {} as Record<string, unknown> }))
vi.mock('plyr', () => ({ default: plyrCtor }))
vi.mock('plyr/dist/plyr.css', () => ({}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({ settings }) }))

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

describe('enablePlyr prevent_skipping_videos', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		settings.data = { prevent_skipping_videos: 1 }
	})
	afterEach(() => (settings.data = {}))

	const setup = async (): Promise<FakePlayer> => {
		const el = document.createElement('div')
		el.className = 'video-player'
		el.setAttribute('src', 'dQw4w9WgXcQ')
		document.body.appendChild(el)
		const [player] = (await enablePlyr()) as unknown as FakePlayer[]
		player.emit('play')
		return player
	}

	// Regression from #1609: the seek listener saw only the progress input, so a
	// keyboard skip got past prevent_skipping_videos. Added on fix/course-progress-enforcement (no PR yet).
	it('snaps a keyboard skip (currentTime assignment) back', async () => {
		const player = await setup()
		player.currentTime = 60
		expect(player.currentTime).toBe(0)
	})
})
