import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// `new pdfjsLib.PDFWorker({ port })` reaches the REAL pdf.js class here even
// though `getDocument` is mocked, so pdf.js spins up its in-process fallback
// worker and rejects "Worker was terminated" when the port is torn down. That
// rejection is unobservable from our code and would fail the whole run despite
// every assertion passing. Absorb only that one message, and fail loudly on
// anything else so this cannot hide a real defect.
const EXPECTED_TEARDOWN_REJECTION = 'Worker was terminated'
const unexpectedRejections: string[] = []
const onRejection = (reason: unknown) => {
	const message = (reason as Error)?.message
	if (message !== EXPECTED_TEARDOWN_REJECTION) {
		unexpectedRejections.push(String(message ?? reason))
	}
}
process.on('unhandledRejection', onRejection)
afterAll(() => {
	process.off('unhandledRejection', onRejection)
	expect(unexpectedRejections).toEqual([])
})

// pdf.js can't be imported in vitest+jsdom (ReferenceError: DOMMatrix), and it
// needs no real rendering to test the lifecycle, so mock it. A shared `state`
// lets each test steer getDocument to resolve or reject.
const state = vi.hoisted(() => ({
	shouldReject: false,
	destroy: vi.fn(),
	cancel: vi.fn(),
	workerPort: null as unknown,
	// The PDFWorker PdfBlock owns itself, plus the loading task it cancels.
	pdfWorkerDestroy: vi.fn(),
	taskDestroy: vi.fn(),
	pdfWorkers: 0,
}))

const makePdf = () => ({
	numPages: 3,
	destroy: state.destroy,
	getPage: vi.fn(async () => ({
		getViewport: () => ({ width: 600, height: 800 }),
		render: () => ({ promise: Promise.resolve(), cancel: state.cancel }),
	})),
})

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
	getDocument: vi.fn(() => ({
		promise: state.shouldReject
			? Promise.reject(new Error('boom'))
			: Promise.resolve(makePdf()),
		destroy: state.taskDestroy,
	})),
	// PdfBlock wraps the shared port in its own PDFWorker and passes it to
	// getDocument, so no loading task can destroy the port other viewers share.
	PDFWorker: class {
		destroy = state.pdfWorkerDestroy
		constructor() {
			state.pdfWorkers++
		}
	},
	GlobalWorkerOptions: {
		set workerPort(v: unknown) {
			state.workerPort = v
		},
		get workerPort() {
			return state.workerPort
		},
	},
}))

// Worker creation is mocked at its module boundary (Vite's worker transform
// can't run pdf.js's worker in jsdom). Count creations + terminations to prove
// the shared, ref-counted worker lifecycle.
const terminate = vi.fn()
const createPdfWorker = vi.hoisted(() => vi.fn())
vi.mock('@/utils/pdfWorker', () => ({ createPdfWorker }))

beforeEach(() => {
	// jsdom's rAF fires on a ~16ms timer, so `nextFrame()` outlives
	// flushPromises() and load() is still mid-flight when a test ends. Running
	// the callback synchronously lets load() finish inside the test instead of
	// leaving pdf.js work pending across teardown (which surfaces as an
	// unhandled "Worker was terminated" rejection and fails the whole run).
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		cb(0)
		return 0
	})
	vi.stubGlobal('cancelAnimationFrame', () => {})
	state.shouldReject = false
	state.destroy.mockClear()
	state.cancel.mockClear()
	state.workerPort = null
	state.pdfWorkerDestroy.mockClear()
	state.taskDestroy.mockClear()
	state.pdfWorkers = 0
	terminate.mockClear()
	createPdfWorker.mockReset()
	createPdfWorker.mockImplementation(() => ({
		terminate,
		postMessage: vi.fn(),
	}))
})
afterEach(() => {
	vi.resetModules()
})

async function mountPdf() {
	const { default: PdfBlock } = await import('@/components/PdfBlock.vue')
	const wrapper = mount(PdfBlock, { props: { file: '/files/x.pdf' } })
	await flushPromises()
	await flushPromises()
	return wrapper
}

describe('PdfBlock', () => {
	it('shows a loading state, then renders one placeholder per page', async () => {
		const wrapper = await mountPdf()
		expect(wrapper.findAll('.pdf-page')).toHaveLength(3)
		expect(wrapper.text()).toContain('1 / 3')
		expect(wrapper.find('.pdf-status').exists()).toBe(false)
		wrapper.unmount()
	})

	it('shows an error state with a fallback link when the PDF fails to load', async () => {
		state.shouldReject = true
		const wrapper = await mountPdf()
		expect(wrapper.find('.pdf-error').exists()).toBe(true)
		expect(wrapper.find('.pdf-fallback-link').attributes('href')).toBe(
			'/files/x.pdf'
		)
		wrapper.unmount()
	})

	it('destroys the document and terminates the worker on unmount', async () => {
		const wrapper = await mountPdf()
		expect(state.destroy).not.toHaveBeenCalled()
		wrapper.unmount()
		expect(state.destroy).toHaveBeenCalledTimes(1)
		// last holder released -> our PDFWorker destroyed, then the port
		expect(state.pdfWorkerDestroy).toHaveBeenCalledTimes(1)
		expect(terminate).toHaveBeenCalledTimes(1)
		// The pdf.js global is never written, so no viewer can strand a
		// terminated port there for the next one to pick up.
		expect(state.workerPort).toBeNull()
	})

	it('releases the worker even if unmounted before load() finishes', async () => {
		// The ref is taken synchronously at mount, so an unmount that races the
		// in-flight dynamic import must still balance it (no stranded worker).
		const { default: PdfBlock } = await import('@/components/PdfBlock.vue')
		const wrapper = mount(PdfBlock, { props: { file: '/files/x.pdf' } })
		expect(createPdfWorker).toHaveBeenCalledTimes(1)
		wrapper.unmount() // before any flushPromises -> load() still pending
		expect(terminate).toHaveBeenCalledTimes(1)
		await flushPromises()
		await flushPromises()
		// the late-resolving load() must not re-acquire a worker
		expect(createPdfWorker).toHaveBeenCalledTimes(1)
	})

	it('ref-counts the shared worker across instances', async () => {
		const { default: PdfBlock } = await import('@/components/PdfBlock.vue')
		const a = mount(PdfBlock, { props: { file: '/files/a.pdf' } })
		const b = mount(PdfBlock, { props: { file: '/files/b.pdf' } })
		await flushPromises()
		await flushPromises()
		// one worker shared by both
		expect(createPdfWorker).toHaveBeenCalledTimes(1)

		// ...and one PDFWorker wrapping it, owned by the module, not by either
		// loading task, so a's teardown can't strand b on the spinner forever.
		expect(state.pdfWorkers).toBe(1)

		a.unmount()
		expect(terminate).not.toHaveBeenCalled() // b still holds it
		expect(state.pdfWorkerDestroy).not.toHaveBeenCalled()
		b.unmount()
		expect(terminate).toHaveBeenCalledTimes(1) // last holder released
		expect(state.pdfWorkerDestroy).toHaveBeenCalledTimes(1)
	})

	// The bug this pins: via GlobalWorkerOptions.workerPort, pdf.js records the
	// SHARED worker on each document's loading task, so one viewer's
	// pdfDoc.destroy() tears down the port-level message handler its siblings
	// are still listening on. Their load then never resolves *and never
	// rejects*, leaving a permanent "Loading PDF…". Passing `worker` explicitly
	// makes pdf.js skip that ownership assignment.
	it('passes the shared worker explicitly instead of via the pdf.js global', async () => {
		const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
		const a = await mountPdf() // fully settled: leaves no pending load()
		const arg = vi.mocked(pdf.getDocument).mock.calls[0][0] as {
			worker?: unknown
		}
		expect(arg.worker).toBeTruthy() // ours, not the loading task's
		expect(state.pdfWorkers).toBe(1)
		expect(state.workerPort).toBeNull() // the global is never written
		a.unmount()
	})

	it('cancels a loading task that has not resolved yet', async () => {
		const { default: PdfBlock } = await import('@/components/PdfBlock.vue')
		const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
		// A load still in flight at unmount: pdfDoc is null, so pdfDoc.destroy()
		// is a no-op and only task.destroy() can cancel it. Settled at the end of
		// the test rather than left dangling: a pending load that outlives
		// vi.resetModules() re-imports the REAL pdf.js and leaks a rejection.
		let settle: (v: unknown) => void = () => {}
		vi.mocked(pdf.getDocument).mockReturnValueOnce({
			promise: new Promise((r) => {
				settle = r
			}),
			destroy: state.taskDestroy,
		} as unknown as ReturnType<typeof pdf.getDocument>)
		const wrapper = mount(PdfBlock, { props: { file: '/files/slow.pdf' } })
		await flushPromises()
		wrapper.unmount()
		expect(state.taskDestroy).toHaveBeenCalledTimes(1)
		settle(makePdf())
		await flushPromises()
	})
})
