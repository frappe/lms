import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SafeEmbed, isSafeEmbedSource } from '../utils/safeEmbed'
import { onDisk } from '@/tests/helpers/designTokens'

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

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

	it('marks only Plyr embeds as loading until their player is ready', () => {
		const loading = 'embed-tool--player-loading'
		expect(render('youtube', 'QhA4h6qD4wY').classList).toContain(loading)
		const url = 'https://drive.google.com/file/d/1A2B/preview'
		expect(render('drive', url).classList).not.toContain(loading)
	})
})

// The block's hover/selected fill spans the whole embed-tool box, so any space
// around the frame shows as grey bands above and below the embed.
describe('embed block box', () => {
	it('keeps the frame flush with the block', async () => {
		globalThis.__ = (text: string) => text
		window.matchMedia ??= (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia
		// @ts-expect-error @/utils is plain JS with no declarations.
		const { getEditorTools } = await import('@/utils')
		const services = getEditorTools().embed.config.services
		for (const [name, service] of Object.entries(services)) {
			const html = (service as { html?: string }).html ?? ''
			expect(html, name).not.toMatch(/margin:\s*[^;'"]*[1-9]/)
		}
		const css = onDisk('styles/blockEditor.css')
		const rule = css.slice(css.indexOf('.cdx-block.embed-tool {'))
		expect(rule.slice(0, rule.indexOf('}'))).toContain('vertical-align: top')
	})
})
