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
