import { describe, expect, it } from 'vitest'
import { oklchToHex } from './oklch'

// The alpha channel is a linear 0-1 opacity, not a colour value, so it must
// not run through the sRGB gamma curve used for R/G/B. Regression guard for
// a bug where alpha=0.5 produced ~0xbb instead of 0x80.
describe('oklchToHex alpha channel', () => {
	it('maps alpha 0.5 to the linear byte 0x80, not the gamma-encoded ~0xbb', () => {
		expect(oklchToHex('oklch(0 0 0 / 0.5)')).toBe('#00000080')
	})

	it('maps alpha 0 to the linear byte 0x00', () => {
		expect(oklchToHex('oklch(0 0 0 / 0)')).toBe('#00000000')
	})

	it('maps alpha 1 to the linear byte 0xff', () => {
		expect(oklchToHex('oklch(0 0 0 / 1)')).toBe('#000000ff')
	})

	it('omits the alpha byte entirely when no alpha is given', () => {
		expect(oklchToHex('oklch(0 0 0)')).toBe('#000000')
	})
})
