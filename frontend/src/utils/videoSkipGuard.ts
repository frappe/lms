// @ts-expect-error stores/settings is still plain JS, so it has no declarations
import { useSettings } from '@/stores/settings'

type GuardEvent =
	| 'timeupdate'
	| 'seeking'
	| 'seeked'
	| 'play'
	| 'pause'
	| 'ended'

export interface SeekablePlayer {
	currentTime: number
	on: (event: GuardEvent, handler: () => void) => void
}

const SEEK_TOLERANCE_SECONDS = 1
const MAX_PLAYBACK_RATE = 2

const skippingPrevented = (): boolean =>
	Boolean(Number(useSettings().settings.data?.prevent_skipping_videos ?? 0))

// Plyr's YouTube provider fires `seeking` before the seek lands and Bunny sends
// no `seeking` at all, so a jump is also detected on timeupdate: playback can
// only have advanced by the wall-clock time since the last sample.
class SkipGuard {
	private furthest = 0
	private lastTime = 0
	private lastSampledAt = Date.now()
	private playing = false
	private snapping = false

	constructor(private readonly player: SeekablePlayer) {
		player.on('timeupdate', this.onTimeUpdate)
		player.on('seeking', this.enforce)
		player.on('seeked', this.enforce)
		player.on('play', this.onPlay)
		player.on('pause', this.onStop)
		player.on('ended', this.onStop)
	}

	allowUpTo(seconds: number): void {
		this.furthest = Math.max(this.furthest, seconds)
	}

	clamp(seconds: number): number {
		if (!skippingPrevented()) return seconds
		if (seconds <= this.furthest + SEEK_TOLERANCE_SECONDS) return seconds
		return this.furthest
	}

	private record(seconds: number): void {
		this.lastTime = seconds
		this.lastSampledAt = Date.now()
	}

	// How far playback can have moved since the last sample; nothing while paused.
	private reach(): number {
		if (!this.playing) return 0
		return ((Date.now() - this.lastSampledAt) / 1000) * MAX_PLAYBACK_RATE
	}

	private enforce = (): boolean => {
		const seconds = this.player.currentTime
		if (this.snapping || !Number.isFinite(seconds)) return false
		const allowed = this.clamp(seconds)
		if (allowed === seconds) return false
		this.snapping = true
		this.player.currentTime = allowed
		this.snapping = false
		this.record(allowed)
		return true
	}

	private onTimeUpdate = (): void => {
		const seconds = this.player.currentTime
		if (!Number.isFinite(seconds)) return
		const reach = this.reach()
		const jumped = seconds - this.lastTime > reach + SEEK_TOLERANCE_SECONDS
		if (jumped && this.enforce()) return
		// Only playback counts as watched, never the seek tolerance, or repeated
		// small seeks would walk through the video.
		this.allowUpTo(Math.min(seconds, this.furthest + reach))
		this.record(seconds)
	}

	private onPlay = (): void => {
		this.playing = true
		this.record(this.lastTime)
	}

	private onStop = (): void => {
		this.playing = false
	}
}

const guards = new WeakMap<object, SkipGuard>()

export function guardPlayerSkips(player: SeekablePlayer): void {
	if (!guards.has(player)) guards.set(player, new SkipGuard(player))
}

export function guardVideoElementSkips(video: HTMLVideoElement): void {
	if (guards.has(video)) return
	const player: SeekablePlayer = {
		get currentTime() {
			return video.currentTime
		},
		set currentTime(seconds) {
			video.currentTime = seconds
		},
		on: (event, handler) => video.addEventListener(event, handler),
	}
	guards.set(video, new SkipGuard(player))
}

// Seeds the furthest point, e.g. from the saved watch position, before a resume
// seeks there.
export function allowSkipUpTo(target: object, seconds: number): void {
	guards.get(target)?.allowUpTo(seconds)
}

export function clampSkipTarget(target: object, seconds: number): number {
	return guards.get(target)?.clamp(seconds) ?? seconds
}
