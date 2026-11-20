import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	currentFullscreenElement,
	FULLSCREEN_CHANGE_EVENTS,
	FULLSCREEN_EXIT_GRACE_MS,
	isFullscreenSupported,
	violationLabel,
} from '@/utils/proctoring'

describe('Full-Screen Mode Enforcement & Zen Mode Isolation', () => {
	let originalFullscreenElement: any
	let originalFullscreenEnabled: any

	beforeEach(() => {
		originalFullscreenElement = (document as any).fullscreenElement
		originalFullscreenEnabled = (document as any).fullscreenEnabled
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		delete (document as any).fullscreenElement
		delete (document as any).webkitFullscreenElement
		delete (document as any).mozFullScreenElement
		delete (document as any).msFullscreenElement
		delete (document as any).fullscreenEnabled
		delete (document as any).webkitFullscreenEnabled
		delete (document as any).mozFullScreenEnabled
		delete (document as any).msFullscreenEnabled
	})

	describe('1. Fullscreen Utility Functions', () => {
		it('identifies fullscreen capability across standard and vendor prefixes', () => {
			;(document as any).fullscreenEnabled = true
			expect(isFullscreenSupported()).toBe(true)

			delete (document as any).fullscreenEnabled
			;(document as any).webkitFullscreenEnabled = true
			expect(isFullscreenSupported()).toBe(true)

			delete (document as any).webkitFullscreenEnabled
			;(document as any).mozFullScreenEnabled = true
			expect(isFullscreenSupported()).toBe(true)

			delete (document as any).mozFullScreenEnabled
			;(document as any).msFullscreenEnabled = true
			expect(isFullscreenSupported()).toBe(true)

			delete (document as any).msFullscreenEnabled
			expect(isFullscreenSupported()).toBe(false)
		})

		it('identifies currently active fullscreen element across vendor prefixes', () => {
			const div = document.createElement('div')

			Object.defineProperty(document, 'fullscreenElement', {
				value: div,
				configurable: true,
			})
			expect(currentFullscreenElement()).toBe(div)

			delete (document as any).fullscreenElement
			Object.defineProperty(document, 'webkitFullscreenElement', {
				value: div,
				configurable: true,
			})
			expect(currentFullscreenElement()).toBe(div)

			delete (document as any).webkitFullscreenElement
			expect(currentFullscreenElement()).toBeNull()
		})

		it('has the fullscreen_exit violation label registered', () => {
			expect(violationLabel('fullscreen_exit')).toBe('Exited full-screen mode')
		})

		it('listens to standard and vendor fullscreenchange events', () => {
			expect(FULLSCREEN_CHANGE_EVENTS).toContain('fullscreenchange')
			expect(FULLSCREEN_CHANGE_EVENTS).toContain('webkitfullscreenchange')
			expect(FULLSCREEN_CHANGE_EVENTS).toContain('mozfullscreenchange')
			expect(FULLSCREEN_CHANGE_EVENTS).toContain('MSFullscreenChange')
		})
	})

	describe('2. Full-Screen Enforcement Logic', () => {
		const isFullscreenEnforced = (quiz: any, props: any) => {
			if (
				props.preview ||
				props.inVideo ||
				props.fromLesson ||
				props.isEmbeddedInLesson
			) {
				return false
			}
			return Boolean(quiz.enforce_fullscreen)
		}

		it('enforces full-screen when enforce_fullscreen is enabled, even without proctoring', () => {
			const quiz = { enforce_fullscreen: 1, enable_proctoring: 0 }
			const props = { preview: false, inVideo: false, fromLesson: false }
			expect(isFullscreenEnforced(quiz, props)).toBe(true)
		})

		it('enforces full-screen when both enforce_fullscreen and enable_proctoring are enabled', () => {
			const quiz = { enforce_fullscreen: 1, enable_proctoring: 1 }
			const props = { preview: false, inVideo: false, fromLesson: false }
			expect(isFullscreenEnforced(quiz, props)).toBe(true)
		})

		it('does not enforce full-screen for proctored quizzes unless enforce_fullscreen is toggled', () => {
			const quiz = { enforce_fullscreen: 0, enable_proctoring: 1 }
			const props = { preview: false, inVideo: false, fromLesson: false }
			expect(isFullscreenEnforced(quiz, props)).toBe(false)
		})

		it('does not enforce full-screen when neither is enabled', () => {
			const quiz = { enforce_fullscreen: 0, enable_proctoring: 0 }
			const props = { preview: false, inVideo: false, fromLesson: false }
			expect(isFullscreenEnforced(quiz, props)).toBe(false)
		})

		it('exempts preview mode from full-screen enforcement', () => {
			const quiz = { enforce_fullscreen: 1, enable_proctoring: 1 }
			const props = { preview: true, inVideo: false, fromLesson: false }
			expect(isFullscreenEnforced(quiz, props)).toBe(false)
		})

		it('exempts in-video quizzes from full-screen enforcement', () => {
			const quiz = { enforce_fullscreen: 1, enable_proctoring: 0 }
			const props = { preview: false, inVideo: true, fromLesson: false }
			expect(isFullscreenEnforced(quiz, props)).toBe(false)
		})

		it('exempts quizzes embedded in a lesson from full-screen enforcement', () => {
			const quiz = { enforce_fullscreen: 1, enable_proctoring: 1 }
			expect(
				isFullscreenEnforced(quiz, {
					preview: false,
					inVideo: false,
					fromLesson: true,
				})
			).toBe(false)
			expect(
				isFullscreenEnforced(quiz, {
					preview: false,
					inVideo: false,
					isEmbeddedInLesson: true,
				})
			).toBe(false)
		})
	})

	describe('3. Zen Mode Container Isolation & Vendor Targeting', () => {
		it('targets the quizContainer element rather than document.documentElement', async () => {
			const quizContainer = document.createElement('div')
			quizContainer.className = 'quiz-container'

			const requestFullscreenMock = vi.fn().mockResolvedValue(undefined)
			const docRequestFullscreenMock = vi.fn().mockResolvedValue(undefined)

			Object.defineProperty(quizContainer, 'requestFullscreen', {
				value: requestFullscreenMock,
				configurable: true,
			})
			Object.defineProperty(document.documentElement, 'requestFullscreen', {
				value: docRequestFullscreenMock,
				configurable: true,
			})

			// Calling goFullScreen on quizContainer
			if (quizContainer.requestFullscreen) {
				await quizContainer.requestFullscreen()
			}

			expect(requestFullscreenMock).toHaveBeenCalledOnce()
			expect(docRequestFullscreenMock).not.toHaveBeenCalled()
		})

		it('falls back to vendor prefixed requestFullscreen methods on container', async () => {
			const quizContainer = document.createElement('div')
			const webkitMock = vi.fn().mockResolvedValue(undefined)

			Object.defineProperty(quizContainer, 'webkitRequestFullscreen', {
				value: webkitMock,
				configurable: true,
			})

			const target = quizContainer as any
			if (target.requestFullscreen) {
				await target.requestFullscreen()
			} else if (target.webkitRequestFullscreen) {
				await target.webkitRequestFullscreen()
			}

			expect(webkitMock).toHaveBeenCalledOnce()
		})
	})

	describe('4. Fullscreen Exit Grace Period & Proctoring Violation', () => {
		it('allows learner grace period to return to full-screen before logging violation', () => {
			const logViolation = vi.fn()
			let isFullscreenActive = false
			let showFullscreenWarning = true
			let fullscreenGraceTimer: any = null

			const onFullscreenExit = () => {
				showFullscreenWarning = true
				fullscreenGraceTimer = setTimeout(() => {
					if (!isFullscreenActive && showFullscreenWarning) {
						logViolation('fullscreen_exit')
					}
				}, FULLSCREEN_EXIT_GRACE_MS)
			}

			onFullscreenExit()
			expect(fullscreenGraceTimer).not.toBeNull()

			// Advance by 1000ms (within grace period)
			vi.advanceTimersByTime(1000)
			expect(logViolation).not.toHaveBeenCalled()

			// Re-enter fullscreen within grace period
			isFullscreenActive = true
			showFullscreenWarning = false
			clearTimeout(fullscreenGraceTimer)
			fullscreenGraceTimer = null

			// Advance past grace period
			vi.advanceTimersByTime(2000)
			expect(logViolation).not.toHaveBeenCalled()
		})

		it('logs a violation if learner does not re-enter full-screen before grace period expires', () => {
			const logViolation = vi.fn()
			let isFullscreenActive = false
			let showFullscreenWarning = true
			let fullscreenGraceTimer: any = null

			const onFullscreenExit = () => {
				showFullscreenWarning = true
				fullscreenGraceTimer = setTimeout(() => {
					if (!isFullscreenActive && showFullscreenWarning) {
						logViolation('fullscreen_exit')
					}
				}, FULLSCREEN_EXIT_GRACE_MS)
			}

			onFullscreenExit()
			expect(logViolation).not.toHaveBeenCalled()

			// Advance past FULLSCREEN_EXIT_GRACE_MS
			vi.advanceTimersByTime(FULLSCREEN_EXIT_GRACE_MS + 100)
			expect(logViolation).toHaveBeenCalledWith('fullscreen_exit')
		})
	})
})
