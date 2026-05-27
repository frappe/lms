import { describe, expect, it } from 'vitest'
import {
	resolveDwellSeconds,
	isVideoComplete,
	shouldStartDwellTimer,
	shouldAttachVideoFallback,
} from '@/utils/lessonProgress'

describe('resolveDwellSeconds', () => {
	it('returns the parsed number for a positive integer', () => {
		expect(resolveDwellSeconds(30)).toBe(30)
		expect(resolveDwellSeconds(45)).toBe(45)
	})

	it('coerces numeric strings (Frappe Check fields can come back as strings)', () => {
		expect(resolveDwellSeconds('30')).toBe(30)
		expect(resolveDwellSeconds('45.5')).toBe(45.5)
	})

	it('returns the fallback default when value is null or undefined', () => {
		expect(resolveDwellSeconds(null)).toBe(30)
		expect(resolveDwellSeconds(undefined)).toBe(30)
	})

	it('honors a custom fallback', () => {
		expect(resolveDwellSeconds(null, 60)).toBe(60)
		expect(resolveDwellSeconds(undefined, 60)).toBe(60)
	})

	it('returns null when value is 0 or negative (dwell disabled)', () => {
		expect(resolveDwellSeconds(0)).toBeNull()
		expect(resolveDwellSeconds(-5)).toBeNull()
		expect(resolveDwellSeconds('0')).toBeNull()
	})

	it('returns null when value is non-numeric', () => {
		expect(resolveDwellSeconds('abc')).toBeNull()
		expect(resolveDwellSeconds(NaN)).toBeNull()
	})
})

describe('isVideoComplete', () => {
	it('returns true when currentTime is within 1 second of duration', () => {
		expect(isVideoComplete(99, 100)).toBe(true)
		expect(isVideoComplete(99.5, 100)).toBe(true)
		expect(isVideoComplete(100, 100)).toBe(true)
	})

	it('returns false when currentTime is more than 1s short', () => {
		expect(isVideoComplete(98, 100)).toBe(false)
		expect(isVideoComplete(0, 100)).toBe(false)
	})

	it('returns false when duration is 0 (video not loaded — avoids false-positive on init)', () => {
		expect(isVideoComplete(0, 0)).toBe(false)
		expect(isVideoComplete(100, 0)).toBe(false)
	})

	it('returns false when duration is negative or NaN', () => {
		expect(isVideoComplete(50, -10)).toBe(false)
		expect(isVideoComplete(NaN, 100)).toBe(false)
		expect(isVideoComplete(50, NaN)).toBe(false)
	})

	it('handles YouTube last-frame skip', () => {
		expect(isVideoComplete(299.04, 300)).toBe(true)
	})
})

describe('shouldStartDwellTimer', () => {
	it('starts when there is no video', () => {
		expect(shouldStartDwellTimer({ hasVideo: false, enforceVideo: false })).toBe(true)
		expect(shouldStartDwellTimer({ hasVideo: false, enforceVideo: true })).toBe(true)
		expect(shouldStartDwellTimer({ hasVideo: false, enforceVideo: 1 })).toBe(true)
	})

	it('starts when there is video but enforcement is off (legacy 30s behavior)', () => {
		expect(shouldStartDwellTimer({ hasVideo: true, enforceVideo: false })).toBe(true)
		expect(shouldStartDwellTimer({ hasVideo: true, enforceVideo: 0 })).toBe(true)
	})

	it('does NOT start when video is present and enforcement is on', () => {
		expect(shouldStartDwellTimer({ hasVideo: true, enforceVideo: true })).toBe(false)
		expect(shouldStartDwellTimer({ hasVideo: true, enforceVideo: 1 })).toBe(false)
	})
})

describe('shouldAttachVideoFallback', () => {
	it('does not attach without a video', () => {
		expect(shouldAttachVideoFallback({ hasVideo: false, enforceVideo: false })).toBe(false)
		expect(shouldAttachVideoFallback({ hasVideo: false, enforceVideo: true })).toBe(false)
	})

	it('does not attach when enforcement is off (no recovery needed)', () => {
		expect(shouldAttachVideoFallback({ hasVideo: true, enforceVideo: false })).toBe(false)
		expect(shouldAttachVideoFallback({ hasVideo: true, enforceVideo: 0 })).toBe(false)
	})

	it('attaches only when both flags are true', () => {
		expect(shouldAttachVideoFallback({ hasVideo: true, enforceVideo: true })).toBe(true)
		expect(shouldAttachVideoFallback({ hasVideo: true, enforceVideo: 1 })).toBe(true)
	})
})
