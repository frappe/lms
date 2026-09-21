import { describe, it, expect, vi } from 'vitest'

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string): string => text
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

vi.mock('frappe-ui', () => ({ call: () => {}, toast: {} }))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

const { default: Embed } = await import('@editorjs/embed')
const { getEditorTools } = await import('@/utils')

type EmbedTool = {
	data: { service: string; embed: string }
	onPaste: (event: unknown) => void
	render: () => HTMLElement
}
type EmbedClass = {
	prepare: (options: { config: unknown }) => void
	pasteConfig: { patterns: Record<string, RegExp> }
	new (options: unknown): EmbedTool
}
const EmbedTool = Embed as unknown as EmbedClass

const tools = getEditorTools() as { embed: { config: unknown } }
EmbedTool.prepare({ config: tools.embed.config })

const api = {
	styles: { block: 'cdx-block', input: 'cdx-input' },
	i18n: { t: (text: string) => text },
}

// Goes through the plugin's own code paths: the paste patterns EditorJS matches a
// pasted URL against, then onPaste, which builds the embed URL from the service's
// regex, id() and embedUrl.
function paste(url: string) {
	const service = Object.entries(EmbedTool.pasteConfig.patterns).find(
		([, pattern]) => pattern.test(url)
	)?.[0]
	if (!service) return { service: undefined, embed: undefined }
	const tool = new EmbedTool({ data: {}, api, readOnly: false })
	tool.onPaste({ detail: { key: service, data: url } })
	return { service: tool.data.service, embed: tool.data.embed }
}

describe('embed services: TED', () => {
	it.each([
		[
			'https://www.ted.com/talks/joshua_foer_feats_of_memory_anyone_can_do',
			'https://embed.ted.com/talks/joshua_foer_feats_of_memory_anyone_can_do',
		],
		[
			'https://ted.com/talks/russell_foster_why_do_we_sleep/',
			'https://embed.ted.com/talks/russell_foster_why_do_we_sleep',
		],
		// ?language= picks the player language, and must survive other params.
		[
			'https://www.ted.com/talks/elizabeth_loftus_how_reliable_is_your_memory?language=fr',
			'https://embed.ted.com/talks/lang/fr/elizabeth_loftus_how_reliable_is_your_memory',
		],
		[
			'https://www.ted.com/talks/some_talk?utm_source=x&language=pt-br&subtitle=en',
			'https://embed.ted.com/talks/lang/pt-br/some_talk',
		],
	])('embeds %s as %s', (url, embed) => {
		expect(paste(url)).toEqual({ service: 'ted', embed })
	})

	it('ignores TED pages that are not talks', () => {
		expect(
			paste('https://www.ted.com/playlists/171/the_most_popular_talks_of_all')
				.service
		).toBeUndefined()
	})
})

describe('embed services: Dailymotion', () => {
	it.each([
		'https://www.dailymotion.com/video/x3zm0q1',
		'https://dailymotion.com/video/x3zm0q1',
		'https://dai.ly/x3zm0q1',
		// Legacy links carry a title slug after the id.
		'https://www.dailymotion.com/video/x3zm0q1_some-video-title',
		'https://www.dailymotion.com/video/x3zm0q1?playlist=x6hynp',
		'https://www.dailymotion.com/embed/video/x3zm0q1',
	])('embeds %s', (url) => {
		expect(paste(url)).toEqual({
			service: 'dailymotion',
			embed: 'https://www.dailymotion.com/embed/video/x3zm0q1',
		})
	})
})

describe('embed services: existing providers are unaffected', () => {
	it('still routes YouTube and Vimeo links to their own services', () => {
		expect(paste('https://www.youtube.com/watch?v=dQw4w9WgXcQ').service).toBe(
			'youtube'
		)
		expect(paste('https://vimeo.com/186084368/5fc562a815')).toEqual({
			service: 'vimeo',
			embed: 'https://player.vimeo.com/video/186084368?h=5fc562a815',
		})
	})
})

describe('embed services: rendering', () => {
	it.each([
		['ted', 'https://embed.ted.com/talks/lang/fr/some_talk'],
		['dailymotion', 'https://www.dailymotion.com/embed/video/x3zm0q1'],
	])(
		'renders a saved %s block as an iframe on its embed URL',
		(service, embed) => {
			const tool = new EmbedTool({
				data: { service, source: embed, embed },
				api,
				readOnly: true,
			})
			const iframe = tool.render().querySelector('iframe')
			expect(iframe?.getAttribute('src')).toBe(embed)
		}
	)
})
