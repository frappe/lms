import { describe, expect, it, vi } from 'vitest'
import { Upload } from '@/utils/upload'

vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})
vi.mock('@/utils/pdfViewer', () => ({ usesWebkitPdfViewer: () => false }))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ user: null }) }))
// The translation plugin loads strings from the server; the test only needs __.
vi.stubGlobal(
	'fetch',
	vi.fn(async () => new Response('{"message": {}}')),
)

// The editor mounts each upload block as its own Vue app, so a component test that
// passes __ in by hand cannot see a block that fails to render here.
describe('an audio block in the lesson editor', () => {
	it.each(['MP3', 'm4a'])('draws the player for a %s file', (fileType) => {
		const tool = new Upload({
			data: {
				file_url: `/private/files/talk.${fileType.toLowerCase()}`,
				file_type: fileType,
			},
			readOnly: false,
		})
		const block = tool.render()

		expect(block.querySelector('[data-testid="audio-player"]')).not.toBeNull()
	})
})

describe('a pasted audio link in the lesson editor', () => {
	const paste = (link: string) => {
		const tool = new Upload({ data: {}, readOnly: false })
		const block = tool.render()
		tool.onPaste({ type: 'pattern', detail: { data: link } })
		return { tool, block }
	}

	it('becomes a player for a file on another host, without the uploader', () => {
		const { tool, block } = paste('https://lms.b-cdn.net/talks/intro.m4a')

		expect(block.querySelector('[data-testid="audio-player"]')).not.toBeNull()
		expect(block.textContent).not.toContain('Upload File')
		expect(tool.save()).toEqual({
			file_url: 'https://lms.b-cdn.net/talks/intro.m4a',
			file_type: 'm4a',
			quizzes: [],
		})
		tool.destroy()
	})

	it('reads the type past a query string, as signed links have', () => {
		const { tool } = paste('https://pub-1.r2.dev/memo.mp3?token=abc')
		expect(tool.save().file_type).toBe('mp3')
		tool.destroy()
	})

	it('is matched only for https audio files', () => {
		const { audio } = Upload.pasteConfig.patterns
		expect(audio.test('https://cdn.example.com/a.mp3')).toBe(true)
		expect(audio.test('http://cdn.example.com/a.mp3')).toBe(false)
		expect(audio.test('https://cdn.example.com/a.mp4')).toBe(false)
	})
})
