import { describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({ createResource: vi.fn() }))

describe('__', () => {
	it('fills values passed the Desk way, as Frappe UI components do', async () => {
		const { default: translationPlugin } = await import('@/translation.js')
		;(window as any).translatedMessages = { 'Row {0}': 'Zeile {0}' }
		translationPlugin({ config: { globalProperties: {} } })
		const __ = (window as any).__

		expect(__('All ({0})', [3])).toBe('All (3)')
		expect(__('Row {0}', [7])).toBe('Zeile 7')
		// The LMS way keeps working.
		expect(__('Row {0}').format(7)).toBe('Zeile 7')
		expect(__('Import')).toBe('Import')
	})
})
