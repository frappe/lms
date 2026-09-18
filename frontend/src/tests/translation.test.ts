import { computed } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { call, getLocal, saveLocal } = vi.hoisted(() => ({
	call: vi.fn(),
	getLocal: vi.fn(),
	saveLocal: vi.fn(),
}))

vi.mock('frappe-ui', () => ({ call, getLocal, saveLocal }))

beforeEach(() => {
	call.mockReset()
	getLocal.mockReset().mockResolvedValue(null)
	saveLocal.mockReset().mockResolvedValue(undefined)
	document.documentElement.lang = 'es'
	delete window.translatedMessages
	vi.resetModules()
})

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe('translation startup', () => {
	it('loads and caches messages before callers continue bootstrapping', async () => {
		call.mockResolvedValue({ Courses: 'Cursos' })
		const { loadTranslations } = await import('@/translation')

		await expect(loadTranslations()).resolves.toEqual({ Courses: 'Cursos' })
		expect(window.translatedMessages).toEqual({ Courses: 'Cursos' })
		expect(call).toHaveBeenCalledOnce()
		expect(call).toHaveBeenCalledWith('lms.lms.api.get_translations')
		expect(getLocal).toHaveBeenCalledWith('["translations","es"]')
		expect(saveLocal).toHaveBeenCalledWith('["translations","es"]', {
			Courses: 'Cursos',
		})
	})

	it('reuses a dictionary already present on the page', async () => {
		window.translatedMessages = { Courses: 'Cursos existentes' }
		const { loadTranslations } = await import('@/translation')

		await expect(loadTranslations()).resolves.toEqual({
			Courses: 'Cursos existentes',
		})
		expect(call).not.toHaveBeenCalled()
		expect(getLocal).not.toHaveBeenCalled()
	})

	it('starts from IndexedDB and refreshes the dictionary in the background', async () => {
		let resolveRequest: (value: { Courses: string }) => void = () => {}
		getLocal.mockResolvedValue({ Courses: 'Cursos guardados' })
		call.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve
			})
		)
		const { default: translationPlugin, loadTranslations } = await import(
			'@/translation'
		)
		translationPlugin({ config: { globalProperties: {} } })

		await expect(loadTranslations()).resolves.toEqual({
			Courses: 'Cursos guardados',
		})
		const label = computed(() => window.__('Courses'))
		expect(label.value).toBe('Cursos guardados')
		resolveRequest({ Courses: 'Cursos nuevos' })
		await vi.waitFor(() => expect(label.value).toBe('Cursos nuevos'))
		expect(saveLocal).toHaveBeenCalledWith('["translations","es"]', {
			Courses: 'Cursos nuevos',
		})
	})

	it('does not let a slow stale cache replace a fresh response', async () => {
		let resolveCache: (value: { Courses: string }) => void = () => {}
		getLocal.mockReturnValue(
			new Promise((resolve) => {
				resolveCache = resolve
			})
		)
		call.mockResolvedValue({ Courses: 'Cursos nuevos' })
		const { loadTranslations } = await import('@/translation')

		await expect(loadTranslations()).resolves.toEqual({
			Courses: 'Cursos nuevos',
		})
		resolveCache({ Courses: 'Cursos viejos' })
		await Promise.resolve()
		await Promise.resolve()
		expect(window.translatedMessages).toEqual({ Courses: 'Cursos nuevos' })
	})

	it('deduplicates concurrent translation requests', async () => {
		let resolveRequest: (value: { Courses: string }) => void = () => {}
		call.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve
			})
		)
		const { loadTranslations } = await import('@/translation')

		const firstRequest = loadTranslations()
		expect(loadTranslations()).toBe(firstRequest)
		await vi.waitFor(() => expect(call).toHaveBeenCalledOnce())
		resolveRequest({ Courses: 'Cursos' })
		await expect(firstRequest).resolves.toEqual({ Courses: 'Cursos' })
	})

	it('uses cached messages when the network fails', async () => {
		getLocal.mockResolvedValue({ Courses: 'Cursos guardados' })
		call.mockRejectedValue(new Error('network unavailable'))
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const { loadTranslations } = await import('@/translation')

		await expect(loadTranslations()).resolves.toEqual({
			Courses: 'Cursos guardados',
		})
		expect(window.translatedMessages).toEqual({ Courses: 'Cursos guardados' })
		expect(warning).not.toHaveBeenCalled()
	})

	it('does not mark a failed load as successful and can retry', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
		call.mockRejectedValueOnce(new Error('network unavailable'))
		call.mockResolvedValueOnce({ Courses: 'Cursos' })
		const { default: translationPlugin, loadTranslations } = await import(
			'@/translation'
		)

		await expect(loadTranslations()).resolves.toEqual({})
		expect(window.translatedMessages).toBeUndefined()
		translationPlugin({ config: { globalProperties: {} } })
		expect(window.__('Courses')).toBe('Courses')
		await expect(loadTranslations()).resolves.toEqual({ Courses: 'Cursos' })
		expect(call).toHaveBeenCalledTimes(2)
		expect(warning).toHaveBeenCalledOnce()
	})

	it('keeps a timed-out request alive and translates when it finishes late', async () => {
		vi.useFakeTimers()
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
		let resolveRequest: (value: { Courses: string }) => void = () => {}
		call.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve
			})
		)
		const { default: translationPlugin, loadTranslations } = await import(
			'@/translation'
		)

		const loading = loadTranslations()
		await vi.advanceTimersByTimeAsync(10_000)
		await expect(loading).resolves.toEqual({})
		expect(window.translatedMessages).toBeUndefined()
		translationPlugin({ config: { globalProperties: {} } })
		const label = computed(() => window.__('Courses'))
		expect(label.value).toBe('Courses')
		const continued = loadTranslations()
		expect(call).toHaveBeenCalledOnce()
		resolveRequest({ Courses: 'Cursos' })
		await expect(continued).resolves.toEqual({ Courses: 'Cursos' })
		await Promise.resolve()
		await Promise.resolve()
		expect(label.value).toBe('Cursos')
		expect(saveLocal).toHaveBeenCalledOnce()
		expect(warning).toHaveBeenCalledOnce()
	})

	it('does not block startup if IndexedDB is unavailable', async () => {
		getLocal.mockRejectedValue(new Error('IndexedDB unavailable'))
		saveLocal.mockRejectedValue(new Error('IndexedDB unavailable'))
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
		call.mockResolvedValue({ Courses: 'Cursos' })
		const { loadTranslations } = await import('@/translation')

		await expect(loadTranslations()).resolves.toEqual({ Courses: 'Cursos' })
		expect(window.translatedMessages).toEqual({ Courses: 'Cursos' })
		await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce())
	})

	it('keeps language-specific dictionaries in separate cache entries', async () => {
		document.documentElement.lang = 'fr'
		call.mockResolvedValue({ Courses: 'Cours' })
		const { loadTranslations } = await import('@/translation')

		await loadTranslations()
		expect(getLocal).toHaveBeenCalledWith('["translations","fr"]')
		expect(saveLocal).toHaveBeenCalledWith('["translations","fr"]', {
			Courses: 'Cours',
		})
	})
})
