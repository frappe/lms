import { afterEach, describe, expect, it } from 'vitest'
import {
	inlineEndSide,
	inlineStartSide,
	isRtl,
	textDirection,
} from '@/utils/textDirection'

describe('textDirection', () => {
	afterEach(() => document.documentElement.removeAttribute('dir'))

	it('maps line start and end to physical sides in LTR', () => {
		document.documentElement.dir = 'ltr'
		expect(isRtl()).toBe(false)
		expect(inlineStartSide()).toBe('left')
		expect(inlineEndSide()).toBe('right')
		expect(textDirection()).toBe('ltr')
	})

	it('swaps them when <html dir> is rtl', () => {
		document.documentElement.dir = 'rtl'
		expect(isRtl()).toBe(true)
		expect(inlineStartSide()).toBe('right')
		expect(inlineEndSide()).toBe('left')
		expect(textDirection()).toBe('rtl')
	})
})
