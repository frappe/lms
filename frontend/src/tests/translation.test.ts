import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
	vi.resetModules()
	delete (window as any).translatedMessages
	delete (window as any).lmsTranslations
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe('__', () => {
	it('fills values passed the Desk way, as Frappe UI components do', async () => {
		;(window as any).translatedMessages = { 'Row {0}': 'Zeile {0}' }
		const { default: translationPlugin } = await import('@/translation.js')
		translationPlugin({ config: { globalProperties: {} } })
		const __ = (window as any).__

		expect(__('All ({0})', [3])).toBe('All (3)')
		expect(__('Row {0}', [7])).toBe('Zeile 7')
		// The LMS way keeps working.
		expect(__('Row {0}').format(7)).toBe('Zeile 7')
		expect(__('Import')).toBe('Import')
	})
})

// Guards the mount gate in main.js: messages must be in before the app renders,
// but a slow or failed request must never leave the page blank.
describe('loadTranslations', () => {
	it('uses the request index.html started', async () => {
		;(window as any).lmsTranslations = Promise.resolve({ Courses: 'الدورات' })
		const fetchSpy = vi.fn()
		vi.stubGlobal('fetch', fetchSpy)
		const { loadTranslations } = await import('@/translation.js')

		await loadTranslations()

		expect((window as any).__('Courses')).toBe('الدورات')
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('lets the app mount when the request hangs, and applies late messages', async () => {
		vi.useFakeTimers()
		let arrive: (messages: Record<string, string>) => void = () => {}
		;(window as any).lmsTranslations = new Promise((resolve) => {
			arrive = resolve
		})
		const { loadTranslations } = await import('@/translation.js')

		const loaded = loadTranslations()
		await vi.advanceTimersByTimeAsync(3000)
		await loaded
		expect((window as any).__('Courses')).toBe('Courses')

		arrive({ Courses: 'الدورات' })
		await vi.runAllTimersAsync()
		expect((window as any).__('Courses')).toBe('الدورات')
	})

	it('re-renders a mounted template when late messages arrive', async () => {
		vi.useFakeTimers()
		let arrive: (messages: Record<string, string>) => void = () => {}
		;(window as any).lmsTranslations = new Promise((resolve) => {
			arrive = resolve
		})
		const { default: translationPlugin, loadTranslations } = await import(
			'@/translation.js'
		)
		const { mount } = await import('@vue/test-utils')
		const loaded = loadTranslations()
		await vi.advanceTimersByTimeAsync(3000)
		await loaded

		const { h } = await import('vue')
		const wrapper = mount(
			{ render: () => h('h1', (window as any).__('Courses')) },
			{ global: { plugins: [translationPlugin] } }
		)
		expect(wrapper.text()).toBe('Courses')

		arrive({ Courses: 'الدورات' })
		await vi.runAllTimersAsync()
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toBe('الدورات')
	})

	it('falls back to English when the request fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const { loadTranslations } = await import('@/translation.js')

		await loadTranslations()

		expect((window as any).__('Courses')).toBe('Courses')
	})
})
