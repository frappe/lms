import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compactNumber } from '@/utils/numberCardFormat'

describe('compactNumber', () => {
	let originalLang: string

	beforeEach(() => {
		originalLang = document.documentElement.lang
		document.documentElement.lang = 'en-US'
	})

	afterEach(() => {
		document.documentElement.lang = originalLang
	})

	it('compacts to one decimal place, like beta.69 NumberChart', () => {
		expect(compactNumber(12345)).toBe('12.3K')
		expect(compactNumber(45.678)).toBe('45.7')
		expect(compactNumber(7)).toBe('7')
	})

	it('follows the document language, as rc.1 charts do', () => {
		document.documentElement.lang = 'de-DE'
		expect(compactNumber(45.678)).toBe('45,7')
	})

	it('falls back to en-US for a missing or invalid language', () => {
		document.documentElement.lang = ''
		expect(compactNumber(45.678)).toBe('45.7')
		document.documentElement.lang = 'en_US'
		expect(compactNumber(45.678)).toBe('45.7')
	})
})
