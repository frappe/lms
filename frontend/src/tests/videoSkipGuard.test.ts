import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const settings = vi.hoisted(() => ({
	data: { prevent_skipping_videos: 1 } as Record<string, unknown>,
}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({ settings }) }))

import {
	allowSkipUpTo,
	clampSkipTarget,
	guardPlayerSkips,
	guardVideoElementSkips,
} from '@/utils/videoSkipGuard'

type Handler = () => void

// Plyr's YouTube provider fires `seeking` before it asks YouTube to seek, so
// the handler still reads the old time; the new one shows up on a later
// timeupdate. `deferSeek` reproduces that ordering.
class FakePlayer {
	private time = 0
	private handlers: Record<string, Handler[]> = {}
	constructor(private deferSeek = false) {}

	get currentTime(): number {
		return this.time
	}
	set currentTime(seconds: number) {
		if (this.deferSeek) {
			this.emit('seeking')
			this.time = seconds
			return
		}
		this.time = seconds
		this.emit('seeking')
	}
	on(event: string, handler: Handler): void {
		;(this.handlers[event] ??= []).push(handler)
	}
	emit(event: string): void {
		this.handlers[event]?.forEach((handler) => handler())
	}
	play(seconds: number): void {
		this.emit('play')
		for (let t = this.time + 0.25; t <= seconds; t += 0.25) {
			vi.advanceTimersByTime(250)
			this.time = t
			this.emit('timeupdate')
		}
	}
	seek(seconds: number): void {
		this.currentTime = seconds
		this.emit('timeupdate')
		this.emit('seeked')
	}
}

beforeEach(() => {
	vi.useFakeTimers()
	settings.data = { prevent_skipping_videos: 1 }
})
afterEach(() => vi.useRealTimers())

// Regression from #1609: a skip that landed after `seeking` (YouTube) or with
// no `seeking` at all (keyboard, Bunny) was never snapped back. Added on fix/course-progress-enforcement (no PR yet).
describe.each([
	{ provider: 'an html5-style player', deferSeek: false },
	{ provider: 'a YouTube-style player', deferSeek: true },
])('prevent_skipping_videos on $provider', ({ deferSeek }) => {
	const setup = (): FakePlayer => {
		const player = new FakePlayer(deferSeek)
		guardPlayerSkips(player)
		return player
	}

	it('snaps a jump past the furthest watched point back to it', () => {
		const player = setup()
		player.play(20)
		player.seek(60)
		expect(player.currentTime).toBe(20)
	})

	it('allows rewinding and returning up to the furthest point', () => {
		const player = setup()
		player.play(30)
		player.seek(5)
		expect(player.currentTime).toBe(5)
		player.seek(30)
		expect(player.currentTime).toBe(30)
	})

	it('allows seeking anywhere when the setting is off', () => {
		settings.data = { prevent_skipping_videos: 0 }
		const player = setup()
		player.play(10)
		player.seek(90)
		expect(player.currentTime).toBe(90)
	})

	it('allows a resume to a saved position that was seeded first', () => {
		const player = setup()
		allowSkipUpTo(player, 120)
		player.seek(120)
		expect(player.currentTime).toBe(120)
		player.seek(125)
		expect(player.currentTime).toBe(120)
	})
})

describe('a jump with no seeking event', () => {
	it('is still caught on the next timeupdate', () => {
		const player = new FakePlayer()
		guardPlayerSkips(player)
		player.play(10)
		vi.advanceTimersByTime(250)
		;(player as unknown as { time: number }).time = 50
		player.emit('timeupdate')
		expect(player.currentTime).toBe(10)
	})

	it('is not mistaken for a skip when timeupdates were throttled', () => {
		const player = new FakePlayer()
		guardPlayerSkips(player)
		player.play(10)
		vi.advanceTimersByTime(60_000)
		;(player as unknown as { time: number }).time = 70
		player.emit('timeupdate')
		player.seek(70)
		expect(player.currentTime).toBe(70)
	})

	it('gives no wall-clock allowance while paused', () => {
		const player = new FakePlayer()
		guardPlayerSkips(player)
		player.play(10)
		player.emit('pause')
		vi.advanceTimersByTime(60_000)
		;(player as unknown as { time: number }).time = 70
		player.emit('timeupdate')
		expect(player.currentTime).toBe(10)
	})
})

describe('repeated small seeks', () => {
	it('never walk past the furthest watched point while paused', () => {
		const player = new FakePlayer()
		guardPlayerSkips(player)
		player.play(10)
		player.emit('pause')
		for (let step = 0; step < 20; step++) player.seek(player.currentTime + 0.9)
		expect(player.currentTime).toBeLessThanOrEqual(11)
	})

	it('advance no faster than the top playback rate while playing', () => {
		const player = new FakePlayer()
		guardPlayerSkips(player)
		player.play(10)
		for (let step = 0; step < 20; step++) {
			vi.advanceTimersByTime(250)
			player.seek(player.currentTime + 0.9)
		}
		expect(player.currentTime).toBeLessThanOrEqual(10 + 5 * 2 + 1)
	})
})

describe('guardVideoElementSkips', () => {
	const setup = (): HTMLVideoElement => {
		const video = document.createElement('video')
		guardVideoElementSkips(video)
		return video
	}

	it('clamps a slider target to the furthest watched point', () => {
		const video = setup()
		allowSkipUpTo(video, 15)
		expect(clampSkipTarget(video, 40)).toBe(15)
		expect(clampSkipTarget(video, 10)).toBe(10)
	})

	it('attaches its listeners once per element', () => {
		const video = document.createElement('video')
		const spy = vi.spyOn(video, 'addEventListener')
		guardVideoElementSkips(video)
		guardVideoElementSkips(video)
		expect(spy).toHaveBeenCalledTimes(6)
	})
})
