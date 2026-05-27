/**
 * Pure helpers for lesson-progress logic. Kept side-effect-free so they can
 * be unit-tested without mounting Lesson.vue or stubbing the Pinia store.
 */

export function resolveDwellSeconds(raw: unknown, fallback = 30): number | null {
	const n = Number(raw ?? fallback)
	if (!Number.isFinite(n) || n <= 0) return null
	return n
}

export function isVideoComplete(currentTime: number, duration: number): boolean {
	if (!Number.isFinite(currentTime) || !Number.isFinite(duration)) return false
	if (duration <= 0) return false
	return currentTime >= duration - 1
}

export function shouldStartDwellTimer(opts: {
	hasVideo: boolean
	enforceVideo: boolean | 0 | 1
}): boolean {
	return !(opts.hasVideo && !!opts.enforceVideo)
}

export function shouldAttachVideoFallback(opts: {
	hasVideo: boolean
	enforceVideo: boolean | 0 | 1
}): boolean {
	return opts.hasVideo && !!opts.enforceVideo
}
