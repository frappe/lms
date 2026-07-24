import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// pdf.js can't be imported in vitest+jsdom (ReferenceError: DOMMatrix), and it
// needs no real rendering to test the lifecycle — mock it. A shared `state`
// lets each test steer getDocument to resolve or reject.
const state = vi.hoisted(() => ({
	shouldReject: false,
	destroy: vi.fn(),
	cancel: vi.fn(),
	workerPort: null as unknown,
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
	})),
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
	state.shouldReject = false
	state.destroy.mockClear()
	state.cancel.mockClear()
	state.workerPort = null
	terminate.mockClear()
	createPdfWorker.mockReset()
	createPdfWorker.mockImplementation(() => ({ terminate, postMessage: vi.fn() }))
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
		// last holder released -> worker terminated + port cleared
		expect(terminate).toHaveBeenCalledTimes(1)
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

		a.unmount()
		expect(terminate).not.toHaveBeenCalled() // b still holds it
		b.unmount()
		expect(terminate).toHaveBeenCalledTimes(1) // last holder released
	})
})
