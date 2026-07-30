import { describe, expect, it } from 'vitest'
import { usesWebkitPdfViewer } from '@/utils/pdfViewer'

const nav = (userAgent: string, platform = 'Win32', maxTouchPoints = 0) => {
	return { userAgent, platform, maxTouchPoints } as unknown as Navigator
}

const IOS_SAFARI =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IOS_CHROME =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.0.0 Mobile/15E148 Safari/604.1'
const MAC_SAFARI =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const CHROME =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const FIREFOX =
	'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0'
const EDGE =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'

describe('usesWebkitPdfViewer', () => {
	it('uses the inline viewer on iOS Safari', () => {
		expect(usesWebkitPdfViewer(nav(IOS_SAFARI, 'iPhone'))).toBe(true)
	})

	// Every iOS browser is WebKit under the skin, so they share the bug.
	it('uses the inline viewer on iOS Chrome', () => {
		expect(usesWebkitPdfViewer(nav(IOS_CHROME, 'iPhone'))).toBe(true)
	})

	it('uses the inline viewer on iPadOS, which claims to be a Mac', () => {
		expect(usesWebkitPdfViewer(nav(MAC_SAFARI, 'MacIntel', 5))).toBe(true)
	})

	it('uses the inline viewer on desktop Safari', () => {
		expect(usesWebkitPdfViewer(nav(MAC_SAFARI, 'MacIntel', 0))).toBe(true)
	})

	it.each([
		['Chrome', CHROME],
		['Firefox', FIREFOX],
		['Edge', EDGE],
	])('keeps the native iframe plugin on %s', (_name, ua) => {
		expect(usesWebkitPdfViewer(nav(ua))).toBe(false)
	})

	it('keeps the native plugin on a desktop Mac running Chrome', () => {
		expect(usesWebkitPdfViewer(nav(CHROME, 'MacIntel', 0))).toBe(false)
	})
})
