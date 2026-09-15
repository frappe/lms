/**
 * ProctoringMonitor.vue — camera gate and violation event emission.
 *
 * Covers: loading state, camera denied, monitoring pill display,
 * tab-switch violation, and camera-disconnect violation.
 *
 * face-api.js is fully mocked so no actual model loading or GPU usage occurs.
 * navigator.mediaDevices.getUserMedia is stubbed per test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProctoringMonitor from '@/components/ProctoringMonitor.vue'

// ─── face-api.js mock ─────────────────────────────────────────────────────────

// vi.mock is hoisted to the top of the file, so any variables it references
// must also be hoisted via vi.hoisted() to be initialised in time.
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

// ─── Camera / stream helpers ──────────────────────────────────────────────────

// Captured by the mock so tests can trigger camera disconnect manually
let trackEndedHandler: (() => void) | null = null

const makeMockStream = () => {
	trackEndedHandler = null
	const track = {
		addEventListener: vi.fn((event: string, cb: () => void) => {
			if (event === 'ended') trackEndedHandler = cb
		}),
		stop: vi.fn(),
	}
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
})

afterEach(() => {
	vi.clearAllMocks()
})

// Each event now carries a camera still as its second argument, so assertions read
// the event type rather than matching the whole payload.
const emittedTypes = (wrapper: any, name: string): string[] =>
	(wrapper.emitted(name) ?? []).map(([type]: [string]) => type)

// ─── Mount helper ─────────────────────────────────────────────────────────────

const mountMonitor = (props: Partial<{ active: boolean; violationCount: number }> = {}) =>
	mount(ProctoringMonitor, {
		props: { maxViolations: 3, active: false, violationCount: 0, ...props },
		global: { mocks: { __: (s: string) => s } },
		attachTo: document.body,
	})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProctoringMonitor — setup phase', () => {
	it('shows the loading label while camera initialises', () => {
		// Before getUserMedia resolves, setupStatus is 'loading'
		const wrapper = mountMonitor()
		expect(wrapper.text()).toContain('Loading camera')
	})

	it('shows an error message and emits camera-denied when access is refused', async () => {
		getUserMediaMock.mockRejectedValue(new Error('NotAllowedError'))
		const wrapper = mountMonitor()
		await flushPromises()
		expect(wrapper.text()).toContain('Camera access was denied')
		expect(wrapper.emitted('camera-denied')).toBeTruthy()
	})

	it('shows "Position your face" label after camera loads', async () => {
		const wrapper = mountMonitor()
		await flushPromises()
		// Models loaded, interval started — setupStatus transitions to 'detecting'
		expect(wrapper.text()).toContain('Position your face')
	})

})

describe('ProctoringMonitor — monitoring phase', () => {
	it('shows the violation count pill', async () => {
		const wrapper = mountMonitor({ active: true, violationCount: 2 })
		await flushPromises()
		expect(wrapper.text()).toContain('2 / 3')
		expect(wrapper.text()).toContain('violations')
	})

	it('pill is red when violation count is greater than zero', async () => {
		const wrapper = mountMonitor({ active: true, violationCount: 1 })
		await flushPromises()
		const pill = wrapper.find('.rounded-full')
		expect(pill.classes().join(' ')).toContain('bg-surface-red-1')
	})

	it('pill is green when there are no violations', async () => {
		const wrapper = mountMonitor({ active: true, violationCount: 0 })
		await flushPromises()
		const pill = wrapper.find('.rounded-full')
		expect(pill.classes().join(' ')).toContain('bg-surface-green-1')
	})

	it('emits violation("tab_switch") when the document becomes hidden', async () => {
		const wrapper = mountMonitor({ active: true })
		await flushPromises()

		Object.defineProperty(document, 'visibilityState', {
			value: 'hidden',
			writable: true,
			configurable: true,
		})
		document.dispatchEvent(new Event('visibilitychange'))

		expect(emittedTypes(wrapper, 'violation')).toContain('tab_switch')
	})

	it('emits violation("camera_disconnect") when the video track ends', async () => {
		const wrapper = mountMonitor({ active: true })
		await flushPromises()

		expect(trackEndedHandler).not.toBeNull()
		trackEndedHandler!()

		expect(emittedTypes(wrapper, 'violation')).toContain('camera_disconnect')
	})
})

describe('ProctoringMonitor — escalation timing', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		// Fake timers drive both the 2s detection loop and Date.now(), which is
		// what the escalation gap is measured against.
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	// jsdom leaves readyState at 0 (HAVE_NOTHING) and runMonitorDetection skips
	// any frame below HAVE_CURRENT_DATA, so without this the loop never looks.
	const mountMonitoring = async () => {
		const wrapper = mountMonitor({ active: true })
		await vi.advanceTimersByTimeAsync(0)
		Object.defineProperty(document.body.querySelector('video')!, 'readyState', {
			value: 4,
			configurable: true,
		})
		return wrapper
	}

	it('warns first and holds the violation back for 10s', async () => {
		// detectAllFaces resolves [] by default — nobody in frame.
		const wrapper = await mountMonitoring()

		// Three consecutive misses on the 2s loop earn the warning.
		await vi.advanceTimersByTimeAsync(6000)
		expect(emittedTypes(wrapper, 'warning')).toContain('no_face')
		expect(wrapper.emitted('violation')).toBeUndefined()

		// Still only a warning at 9.999s after it — the gap is a full 10 seconds.
		await vi.advanceTimersByTimeAsync(9999)
		expect(wrapper.emitted('violation')).toBeUndefined()

		// The next detection pass after the gap elapses records the violation.
		await vi.advanceTimersByTimeAsync(1)
		expect(emittedTypes(wrapper, 'violation')).toContain('no_face')

		wrapper.unmount()
	})

	it('does not escalate when the face comes back within the gap', async () => {
		const wrapper = await mountMonitoring()

		await vi.advanceTimersByTimeAsync(6000)
		expect(emittedTypes(wrapper, 'warning')).toContain('no_face')

		// One face again, well inside the 10s the student had to correct it.
		detectAllFacesMock.mockResolvedValue([{}])
		await vi.advanceTimersByTimeAsync(20000)

		expect(wrapper.emitted('violation')).toBeUndefined()

		wrapper.unmount()
	})
})

// The floating preview is teleported to the body, so it is queried there rather
// than through the wrapper.
describe('ProctoringMonitor — floating camera', () => {
	const buttonLabelled = (label: string) =>
		[...document.body.querySelectorAll('button')].find(
			(button) => button.getAttribute('aria-label') === label
		)

	beforeEach(() => {
		// Earlier tests mount without unmounting, and their teleported panels stay
		// behind. Start each of these from an empty body so the queries are exact.
		document.body.innerHTML = ''
	})

	it('shows the camera over the quiz while monitoring', async () => {
		const wrapper = mountMonitor({ active: true })
		await flushPromises()

		expect(document.body.querySelector('video')).not.toBeNull()
		expect(buttonLabelled('Minimise camera')).toBeDefined()
		expect(document.body.textContent).not.toContain('Show camera')

		wrapper.unmount()
	})

	it('keeps the video mounted once minimised, so detection continues', async () => {
		const wrapper = mountMonitor({ active: true })
		await flushPromises()

		buttonLabelled('Minimise camera')!.click()
		await flushPromises()

		// The point of the whole feature: hiding the preview must not take the
		// stream away, or the student collects violations for a camera they were
		// invited to put out of sight.
		expect(document.body.querySelector('video')).not.toBeNull()
		expect(document.body.textContent).toContain('Show camera')

		wrapper.unmount()
	})

	it('restores the camera after minimising', async () => {
		const wrapper = mountMonitor({ active: true })
		await flushPromises()

		buttonLabelled('Minimise camera')!.click()
		await flushPromises()
		buttonLabelled('Show camera')!.click()
		await flushPromises()

		expect(buttonLabelled('Minimise camera')).toBeDefined()
		expect(document.body.textContent).not.toContain('Show camera')

		wrapper.unmount()
	})
})
