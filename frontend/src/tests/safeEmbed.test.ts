import { beforeAll, describe, expect, it } from 'vitest'
import { SafeEmbed, isSafeEmbedSource } from '../utils/safeEmbed'

const api = {
	styles: { block: 'cdx-block', input: 'cdx-input' },
	i18n: { t: (text: string) => text },
}

const render = (service: string, embed: unknown): HTMLElement =>
	new SafeEmbed({
		data: { service, source: 'x', embed: embed as string },
		api,
		readOnly: true,
	}).render()

beforeAll(() => {
	SafeEmbed.prepare({
		config: {
			services: {
				drive: {
					regex: /^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view$/,
					embedUrl: 'https://drive.google.com/file/d/<%= remote_id %>/preview',
					html: '<iframe></iframe>',
				},
				youtube: {
					regex: /^https:\/\/youtu\.be\/([\w-]+)$/,
					embedUrl: '<%= remote_id %>',
					html: '<div class="video-player"></div>',
				},
			},
		},
	})
})

describe('SafeEmbed', () => {
	it('frames an external https URL', () => {
		const url = 'https://drive.google.com/file/d/1A2B/preview'
		expect(render('drive', url).querySelector('iframe')?.src).toBe(url)
	})

	it('renders no iframe for a stored source that is not an external URL', () => {
		const host = window.location.host
		for (const embed of [
			'javascript:alert(document.domain)//x',
			'JaVaScRiPt:alert(1)',
			' javascript:alert(1)',
			'java\tscript:alert(1)',
			'javascript&colon;alert(1)',
			'data:text/html,%3Cscript%3Ealert(1)%3C/script%3E',
			'https:\t//evil.example',
			'/files/page.html',
			'//evil.example/x',
			`https://${host}/files/page.html`,
			`https://${host}\\@evil.example/x`,
			'',
			undefined,
		]) {
			const el = render('drive', embed)
			expect(el.querySelector('iframe'), String(embed)).toBeNull()
		}
	})

	it('keeps a bare YouTube video id', () => {
		expect(isSafeEmbedSource('youtube', 'QhA4h6qD4wY')).toBe(true)
		expect(
			render('youtube', 'QhA4h6qD4wY').querySelector('.video-player')
		).not.toBeNull()
		expect(isSafeEmbedSource('drive', 'QhA4h6qD4wY')).toBe(false)
		expect(isSafeEmbedSource('youtube', 'javascript:alert(1)')).toBe(false)
	})
})
