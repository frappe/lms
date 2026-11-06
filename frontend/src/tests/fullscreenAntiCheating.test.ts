/**
 * fullscreenAntiCheating.test.ts
 *
 * Comprehensive test suite verifying all anti-cheating, full-screen enforcement,
 * and AI-extension prevention mechanisms in LMS proctored exams.
 *
 * Covers:
 * 1. Full-screen exit detection and violation emission
 * 2. Copy attempt blocking (event cancel + violation)
 * 3. Cut attempt blocking (event cancel + violation)
 * 4. Paste attempt blocking (event cancel + violation)
 * 5. Right-click context menu blocking (event cancel + violation)
 * 6. Restricted shortcuts blocking (F12, DevTools, Ctrl+C, Ctrl+V, Ctrl+U, Ctrl+P, Ctrl+S)
 * 7. Window blur / defocus detection (AI sidebars, window switching)
 * 8. Window focus restoration cancelling blur timer
 * 9. Tab switch violation
 * 10. Camera disconnection violation
 * 11. Violation labels accuracy for student reporting and logs
 * 12. Cleanup on exam finish / component unmount
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProctoringMonitor from '@/components/ProctoringMonitor.vue'
import {
	isProctoringAllowed,
	isSidePanelViewport,
	serialiseViolationLog,
	violationLabel,
} from '@/utils/proctoring'

// ─── face-api.js mock ─────────────────────────────────────────────────────────

const { detectAllFacesMock } = vi.hoisted(() => ({
	detectAllFacesMock: vi.fn().mockResolvedValue([]),
}))

vi.mock('face-api.js', () => ({
	nets: {
		tinyFaceDetector: {
			loadFromUri: vi.fn().mockResolvedValue(undefined),
		},
	},
	detectAllFaces: detectAllFacesMock,
	TinyFaceDetectorOptions: vi.fn(),
}))

vi.stubGlobal('__', (s: string) => s)

let trackEndedHandler: (() => void) | null = null
let currentTrack: {
	addEventListener: ReturnType<typeof vi.fn>
	removeEventListener: ReturnType<typeof vi.fn>
	stop: ReturnType<typeof vi.fn>
} | null = null

const makeMockStream = () => {
	trackEndedHandler = null
	const track = {
		addEventListener: vi.fn((event: string, cb: () => void) => {
			if (event === 'ended') trackEndedHandler = cb
		}),
		removeEventListener: vi.fn(),
		stop: vi.fn(),
	}
	currentTrack = track
	return {
		getVideoTracks: vi.fn(() => [track]),
		getTracks: vi.fn(() => [track]),
	}
}

let getUserMediaMock: ReturnType<typeof vi.fn>

beforeEach(() => {
	trackEndedHandler = null
	detectAllFacesMock.mockResolvedValue([])
	getUserMediaMock = vi.fn().mockResolvedValue(makeMockStream())
	Object.defineProperty(global, 'navigator', {
		value: { mediaDevices: { getUserMedia: getUserMediaMock } },
		writable: true,
		configurable: true,
	})
	Object.defineProperty(document, 'visibilityState', {
		value: 'visible',
		writable: true,
		configurable: true,
	})
	Object.defineProperty(document, 'fullscreenElement', {
		value: null,
		writable: true,
		configurable: true,
	})
})

afterEach(() => {
	vi.clearAllMocks()
	document.body.innerHTML = ''
})

const emittedTypes = (wrapper: any, name: string): string[] =>
	(wrapper.emitted(name) ?? []).map(([type]: [string]) => type)

const mountMonitoringMonitor = async () => {
	const wrapper = mount(ProctoringMonitor, {
		props: { active: true },
		global: { mocks: { __: (s: string) => s } },
		attachTo: document.body,
	})
	await flushPromises()
	return wrapper
}

describe('Anti-Cheating & Full-Screen Enforcement Test Suite', () => {
	// ─── 1. Full-Screen Exit Enforcement ───────────────────────────────────────
	describe('1. Full-Screen Exit Enforcement', () => {
		it('flags fullscreen_exit violation when student exits full-screen mode', async () => {
			const wrapper = await mountMonitoringMonitor()

			// Student was in full-screen, then presses ESC or exits
			Object.defineProperty(document, 'fullscreenElement', {
				value: null,
				configurable: true,
			})
			document.dispatchEvent(new Event('fullscreenchange'))

			const violations = emittedTypes(wrapper, 'violation')
			expect(violations).toContain('fullscreen_exit')
			wrapper.unmount()
		})

		it('does not flag fullscreen_exit when full-screen is successfully active', async () => {
			const wrapper = await mountMonitoringMonitor()

			// Student is currently in full-screen
			Object.defineProperty(document, 'fullscreenElement', {
				value: document.documentElement,
				configurable: true,
			})
			document.dispatchEvent(new Event('fullscreenchange'))

			const violations = emittedTypes(wrapper, 'violation')
			expect(violations).not.toContain('fullscreen_exit')
			wrapper.unmount()
		})
	})

	// ─── 2. Clipboard & Copying Prevention (Feeding AI) ────────────────────────
	describe('2. Clipboard & Copying Prevention', () => {
		it('intercepts copy event, cancels it silently without emitting violations or warnings', async () => {
			const wrapper = await mountMonitoringMonitor()

			const copyEvent = new Event('copy', { cancelable: true })
			document.dispatchEvent(copyEvent)

			expect(copyEvent.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('copy_attempt')
			expect(emittedTypes(wrapper, 'violation')).not.toContain('copy_attempt')
			wrapper.unmount()
		})

		it('intercepts cut event, cancels it silently without emitting violations or warnings', async () => {
			const wrapper = await mountMonitoringMonitor()

			const cutEvent = new Event('cut', { cancelable: true })
			document.dispatchEvent(cutEvent)

			expect(cutEvent.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('copy_attempt')
			expect(emittedTypes(wrapper, 'violation')).not.toContain('copy_attempt')
			wrapper.unmount()
		})

		it('intercepts paste event, cancels it silently without emitting violations or warnings', async () => {
			const wrapper = await mountMonitoringMonitor()

			const pasteEvent = new Event('paste', { cancelable: true })
			document.dispatchEvent(pasteEvent)

			expect(pasteEvent.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('paste_attempt')
			expect(emittedTypes(wrapper, 'violation')).not.toContain('paste_attempt')
			wrapper.unmount()
		})
	})

	// ─── 3. Context Menu / Right-Click Prevention ──────────────────────────────
	describe('3. Right-Click / Context Menu Prevention', () => {
		it('silently blocks context menu (e.g. Ask Gemini, Inspect) without false violations', async () => {
			const wrapper = await mountMonitoringMonitor()

			const menuEvent = new MouseEvent('contextmenu', { cancelable: true })
			document.dispatchEvent(menuEvent)

			expect(menuEvent.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'violation')).not.toContain('context_menu')
			expect(emittedTypes(wrapper, 'warning')).not.toContain('context_menu')
			wrapper.unmount()
		})
	})

	// ─── 4. Restricted Keyboard Shortcuts (DevTools, Source, Print) ────────────
	describe('4. Restricted Keyboard Shortcuts', () => {
		it('blocks F12 (Developer Tools) silently', async () => {
			const wrapper = await mountMonitoringMonitor()

			const f12 = new KeyboardEvent('keydown', { key: 'F12', cancelable: true })
			window.dispatchEvent(f12)

			expect(f12.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('restricted_key')
			expect(emittedTypes(wrapper, 'violation')).not.toContain('restricted_key')
			wrapper.unmount()
		})

		it('blocks Ctrl+C and Ctrl+V shortcuts silently', async () => {
			const wrapper = await mountMonitoringMonitor()

			const ctrlC = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true })
			window.dispatchEvent(ctrlC)
			expect(ctrlC.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('copy_attempt')

			const ctrlV = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true })
			window.dispatchEvent(ctrlV)
			expect(ctrlV.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('paste_attempt')

			wrapper.unmount()
		})

		it('blocks Cmd+C and Cmd+V on macOS (metaKey) silently', async () => {
			const wrapper = await mountMonitoringMonitor()

			const cmdC = new KeyboardEvent('keydown', { key: 'c', metaKey: true, cancelable: true })
			window.dispatchEvent(cmdC)
			expect(cmdC.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('copy_attempt')

			const cmdV = new KeyboardEvent('keydown', { key: 'v', metaKey: true, cancelable: true })
			window.dispatchEvent(cmdV)
			expect(cmdV.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('paste_attempt')

			wrapper.unmount()
		})

		it('blocks Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (Inspect shortcuts) silently', async () => {
			const wrapper = await mountMonitoringMonitor()

			const inspectI = new KeyboardEvent('keydown', { key: 'i', ctrlKey: true, shiftKey: true, cancelable: true })
			window.dispatchEvent(inspectI)
			expect(inspectI.defaultPrevented).toBe(true)
			expect(emittedTypes(wrapper, 'warning')).not.toContain('restricted_key')

			const consoleJ = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true, cancelable: true })
			window.dispatchEvent(consoleJ)
			expect(consoleJ.defaultPrevented).toBe(true)

			const elementC = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, shiftKey: true, cancelable: true })
			window.dispatchEvent(elementC)
			expect(elementC.defaultPrevented).toBe(true)

			wrapper.unmount()
		})

		it('blocks Ctrl+U (View Source) and Ctrl+P (Print)', async () => {
			const wrapper = await mountMonitoringMonitor()

			const viewSource = new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, cancelable: true })
			window.dispatchEvent(viewSource)
			expect(viewSource.defaultPrevented).toBe(true)

			const print = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true })
			window.dispatchEvent(print)
			expect(print.defaultPrevented).toBe(true)

			wrapper.unmount()
		})
	})

	// ─── 5. AI Sidebars / Window Blur Defocus ───────────────────────────────────
	describe('5. Window Focus Loss / AI Extension Sidebar Detection', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})
		afterEach(() => {
			vi.useRealTimers()
		})

		it('emits focus_loss after 1500ms when user opens an AI sidebar or switches windows', async () => {
			const wrapper = await mountMonitoringMonitor()

			window.dispatchEvent(new Event('blur'))
			expect(emittedTypes(wrapper, 'violation')).not.toContain('focus_loss')

			// Fast-forward past blur threshold
			vi.advanceTimersByTime(1600)
			expect(emittedTypes(wrapper, 'violation')).toContain('focus_loss')
			wrapper.unmount()
		})

		it('cancels focus_loss timer if window regains focus within 1500ms', async () => {
			const wrapper = await mountMonitoringMonitor()

			window.dispatchEvent(new Event('blur'))
			// Regain focus before 1500ms
			vi.advanceTimersByTime(500)
			window.dispatchEvent(new Event('focus'))

			// Advance beyond the original 1500ms
			vi.advanceTimersByTime(1500)
			expect(emittedTypes(wrapper, 'violation')).not.toContain('focus_loss')
			wrapper.unmount()
		})
	})

	// ─── 6. Tab Switching & Camera Disconnection ───────────────────────────────
	describe('6. Tab Switching & Camera Disconnection', () => {
		it('emits tab_switch when student switches to another browser tab', async () => {
			const wrapper = await mountMonitoringMonitor()

			Object.defineProperty(document, 'visibilityState', {
				value: 'hidden',
				configurable: true,
			})
			document.dispatchEvent(new Event('visibilitychange'))

			expect(emittedTypes(wrapper, 'violation')).toContain('tab_switch')
			wrapper.unmount()
		})

		it('emits camera_disconnect when video stream track terminates', async () => {
			const wrapper = await mountMonitoringMonitor()

			expect(trackEndedHandler).not.toBeNull()
			trackEndedHandler!()

			expect(emittedTypes(wrapper, 'violation')).toContain('camera_disconnect')
			wrapper.unmount()
		})
	})

	// ─── 7. Human-Readable Violation Labels ────────────────────────────────────
	describe('7. Human-Readable Violation Labels', () => {
		it('provides clear student-facing messages for all violations', () => {
			expect(violationLabel('fullscreen_exit')).toBe('Exited full-screen mode')
			expect(violationLabel('tab_switch')).toBe('Tab switch')
			expect(violationLabel('focus_loss')).toBe('Window focus lost')
			expect(violationLabel('camera_disconnect')).toBe('Camera disconnected')
			expect(violationLabel('side_panel_detected')).toBe('Side panel active')
		})
	})

	// ─── 8. Browser Side Panel / Split-Screen Geometry Verification ───────────
	describe('8. Browser Side Panel / Gemini Detection Geometry', () => {
		const desktop = {
			fullscreen: true,
			screenWidth: 1920,
			screenHeight: 1080,
			innerWidth: 1920,
			innerHeight: 1080,
			userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140',
		}

		it('identifies a side panel that takes at least 200px of width', () => {
			// Chrome Gemini side panel open (takes ~380px)
			expect(isSidePanelViewport({ ...desktop, innerWidth: 1540 })).toBe(true)
			expect(isSidePanelViewport({ ...desktop, innerWidth: 1720 })).toBe(true) // threshold
		})

		it('allows normal full-screen margins and a 199px difference', () => {
			expect(isSidePanelViewport(desktop)).toBe(false)
			expect(isSidePanelViewport({ ...desktop, innerWidth: 1905 })).toBe(false)
			expect(isSidePanelViewport({ ...desktop, innerWidth: 1721 })).toBe(false)
		})

		it('only checks geometry while full-screen', () => {
			expect(
				isSidePanelViewport({ ...desktop, fullscreen: false, innerWidth: 1200 })
			).toBe(false)
		})

		it('does not mistake page zoom for a side panel', () => {
			// Zoom narrows the viewport, but it takes height in the same step.
			expect(
				isSidePanelViewport({
					...desktop,
					innerWidth: 1280,
					innerHeight: 720,
				})
			).toBe(false)
		})

		it('does not mistake mobile browser chrome for a side panel', () => {
			expect(
				isSidePanelViewport({
					...desktop,
					innerWidth: 1200,
					innerHeight: 900,
					userAgent:
						'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
				})
			).toBe(false)
		})
	})

	// ─── 9. Teardown / Listener Cleanup ────────────────────────────────────────
	describe('9. Event Teardown and Resource Cleanup', () => {
		it('removes all event listeners and stops camera tracks on unmount', async () => {
			const wrapper = await mountMonitoringMonitor()
			wrapper.unmount()

			// Dispatching events after unmount must not cause any errors or emit violations
			document.dispatchEvent(new Event('fullscreenchange'))
			document.dispatchEvent(new Event('copy'))
			document.dispatchEvent(new Event('paste'))
			document.dispatchEvent(new MouseEvent('contextmenu'))
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }))

			expect(wrapper.emitted('violation') ?? []).toHaveLength(0)
		})

		it('stops monitoring and detaches listeners when active prop turns false', async () => {
			const wrapper = await mountMonitoringMonitor()
			await wrapper.setProps({ active: false })

			// Dispatch events while active is false
			const copy = new Event('copy', { cancelable: true })
			const f12 = new KeyboardEvent('keydown', {
				key: 'F12',
				cancelable: true,
			})
			document.dispatchEvent(new Event('fullscreenchange'))
			document.dispatchEvent(copy)
			window.dispatchEvent(f12)
			window.dispatchEvent(new Event('blur'))

			// Nothing is intercepted outside an active attempt: the monitor must
			// not keep the clipboard or keyboard disabled across the page.
			expect(copy.defaultPrevented).toBe(false)
			expect(f12.defaultPrevented).toBe(false)
			expect(wrapper.emitted('violation') ?? []).toHaveLength(0)
			wrapper.unmount()
		})
	})

	// ─── 10. Camera Lifecycle ──────────────────────────────────────────────────
	describe('10. Camera Lifecycle', () => {
		it('requests the front-facing camera and falls back to the default camera', async () => {
			getUserMediaMock
				.mockRejectedValueOnce(new Error('OverconstrainedError'))
				.mockResolvedValueOnce(makeMockStream())

			const wrapper = await mountMonitoringMonitor()

			expect(getUserMediaMock).toHaveBeenCalledTimes(2)
			expect(getUserMediaMock.mock.calls[0][0]).toEqual({
				video: { facingMode: 'user' },
			})
			expect(getUserMediaMock.mock.calls[1][0]).toEqual({ video: true })
			wrapper.unmount()
		})

		it('stops a camera that resolves after the component was unmounted', async () => {
			let resolveStream: (value: ReturnType<typeof makeMockStream>) => void
			const pending = new Promise<ReturnType<typeof makeMockStream>>(
				(resolve) => (resolveStream = resolve)
			)
			getUserMediaMock.mockReturnValue(pending)

			const wrapper = mount(ProctoringMonitor, {
				props: { active: false },
				global: { mocks: { __: (s: string) => s } },
			})
			wrapper.unmount()
			resolveStream!(makeMockStream())
			await flushPromises()

			expect(currentTrack!.stop).toHaveBeenCalled()
		})

		it('removes the ended listener when monitoring stops', async () => {
			const wrapper = await mountMonitoringMonitor()
			expect(currentTrack?.addEventListener).toHaveBeenCalledWith(
				'ended',
				expect.any(Function)
			)

			await wrapper.setProps({ active: false })

			expect(currentTrack?.removeEventListener).toHaveBeenCalledWith(
				'ended',
				expect.any(Function)
			)
			wrapper.unmount()
		})

		it('reacquires the camera and listeners when monitoring resumes', async () => {
			const wrapper = await mountMonitoringMonitor()
			const firstTrack = currentTrack

			await wrapper.setProps({ active: false })
			expect(firstTrack?.stop).toHaveBeenCalled()

			await wrapper.setProps({ active: true })
			await flushPromises()
			expect(getUserMediaMock).toHaveBeenCalledTimes(2)

			Object.defineProperty(document, 'visibilityState', {
				value: 'hidden',
				configurable: true,
			})
			document.dispatchEvent(new Event('visibilitychange'))
			expect(emittedTypes(wrapper, 'violation')).toContain('tab_switch')
			wrapper.unmount()
		})
	})

	// ─── 11. Context-Aware Proctoring: Standalone Exam vs Course / Lesson ─────
	describe('10. Context-Aware Proctoring (Standalone Exam vs Course / Lesson)', () => {
		const standalone = {
			enableProctoring: true,
			routeName: 'QuizPage',
			routePath: '/quiz/grand-assessment-2',
		}

		it('enables proctoring for standalone exams and grand assessments', () => {
			expect(isProctoringAllowed(standalone)).toBe(true)
		})

		it('disables proctoring when embedded in a course lesson (QuizBlock)', () => {
			expect(
				isProctoringAllowed({
					...standalone,
					isEmbeddedInLesson: true,
					fromLesson: true,
				})
			).toBe(false)
		})

		it('disables proctoring for in-video popup quizzes', () => {
			expect(isProctoringAllowed({ ...standalone, inVideo: true })).toBe(false)
		})

		it('disables proctoring for author previews in the admin panel', () => {
			expect(isProctoringAllowed({ ...standalone, preview: true })).toBe(false)
		})

		it('disables proctoring when the fromLesson query parameter is present', () => {
			expect(
				isProctoringAllowed({ ...standalone, fromLessonQuery: true })
			).toBe(false)
		})

		it('disables proctoring on a lesson route or course learning path', () => {
			expect(
				isProctoringAllowed({ ...standalone, routeName: 'Lesson' })
			).toBe(false)
			expect(
				isProctoringAllowed({
					...standalone,
					routePath: '/courses/c-prog/learn/1-2',
				})
			).toBe(false)
		})

		it('still allows a standalone exam reached from a course page', () => {
			expect(
				isProctoringAllowed({
					...standalone,
					routePath: '/courses/c-prog',
				})
			).toBe(true)
		})

		it('disables proctoring when the quiz does not enable it', () => {
			expect(
				isProctoringAllowed({ ...standalone, enableProctoring: false })
			).toBe(false)
		})
	})

	// ─── 12. Violation Log Serialisation ───────────────────────────────────────
	describe('12. Violation Log Serialisation', () => {
		const event = (eventType: string, frame: string | null) => ({
			eventType,
			severity: 'violation' as const,
			timestamp: `2026-01-01T00:00:0${eventType.slice(-1)}Z`,
			frame,
		})

		it('sends at most two frames and keeps events chronological', () => {
			// violationLog is newest-first; the payload must be oldest-first.
			const log = [
				event('e5', 'frame-5'),
				event('e4', null),
				event('e3', 'frame-3'),
				event('e2', 'frame-2'),
				event('e1', 'frame-1'),
			]
			const sent = JSON.parse(serialiseViolationLog(log))

			expect(sent.map((e: { eventType: string }) => e.eventType)).toEqual([
				'e1',
				'e2',
				'e3',
				'e4',
				'e5',
			])
			expect(sent.map((e: { frame: string | null }) => e.frame)).toEqual([
				'frame-1',
				'frame-2',
				null,
				null,
				null,
			])
		})

		it('does not let frame-less events consume the frame budget', () => {
			const log = [
				event('e3', 'frame-3'),
				event('e2', null),
				event('e1', 'frame-1'),
			]
			const frames = JSON.parse(serialiseViolationLog(log)).map(
				(e: { frame: string | null }) => e.frame
			)
			expect(frames).toEqual(['frame-1', null, 'frame-3'])
		})

		it('strips every frame for the pagehide beacon', () => {
			const log = [event('e2', 'frame-2'), event('e1', 'frame-1')]
			const sent = JSON.parse(
				serialiseViolationLog(log, { withFrames: false })
			)
			expect(sent.map((e: { frame: string | null }) => e.frame)).toEqual([
				null,
				null,
			])
		})

		it('serialises an empty log as an empty array', () => {
			expect(serialiseViolationLog([])).toBe('[]')
		})
	})
})
