import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Plyr's YouTube provider REPLACES the element it is given —
// `player.media = replaceElement(container, player.media)` (plyr.mjs:5901), i.e.
// `oldChild.parentNode.replaceChild(newChild, oldChild)`, and the replacement
// carries no `video-player` class. The fake must do the same or the mock hides
// the class of bug where Vue keeps patching a node Plyr already detached.
const plyrCtor = vi.hoisted(() =>
	vi.fn(function FakePlyr(this: { on: () => void }, el: Element) {
		this.on = () => {}
		if (el?.parentNode) {
			const container = document.createElement('div')
			container.id = 'plyr-youtube-fake'
			container.setAttribute(
				'data-replaced-embed-id',
				el.getAttribute('data-plyr-embed-id') || ''
			)
			el.parentNode.replaceChild(container, el)
		}
	})
)
vi.mock('plyr', () => ({ default: plyrCtor }))
vi.mock('plyr/dist/plyr.css', () => ({}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))
vi.mock('@/components/QuizBlock.vue', () => ({
	default: { props: ['quiz'], template: '<div class="quiz-stub" />' },
}))
vi.mock('@/components/PdfBlock.vue', () => ({
	default: { props: ['file'], template: '<div class="pdf-stub" />' },
}))

import LessonContent from '@/components/LessonContent.vue'
import { enablePlyr } from '@/utils/plyr'
import { shouldStartDwellTimer } from '@/utils/lessonProgress'

vi.stubGlobal('__', (s: string) => s)

const mountContent = (props: { content: string; youtube?: string }) =>
	mount(LessonContent, { props, attachTo: document.body })

describe('LessonContent renders tracked Plyr markup for YouTube', () => {
	beforeEach(() => {
		plyrCtor.mockClear()
		document.body.innerHTML = ''
	})

	it('renders the youtube field as a .video-player, not a bare iframe', () => {
		const wrapper = mountContent({
			content: 'Some intro text',
			youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		})

		const player = wrapper.get('.video-player')
		expect(player.attributes('data-plyr-provider')).toBe('youtube')
		expect(player.attributes('data-plyr-embed-id')).toBe('dQw4w9WgXcQ')
		expect(wrapper.find('iframe.youtube-video').exists()).toBe(false)
	})

	it.each([
		['https://www.youtube.com/watch?v=abc123XYZ_-', 'abc123XYZ_-'],
		['https://youtu.be/abc123XYZ_-', 'abc123XYZ_-'],
		['https://www.youtube.com/embed/abc123XYZ_-', 'abc123XYZ_-'],
		['https://www.youtube.com/watch?v=abc123XYZ_-&t=42s', 'abc123XYZ_-'],
		['abc123XYZ_-', 'abc123XYZ_-'],
	])('extracts the embed id from %s', (url, expected) => {
		const wrapper = mountContent({ content: 'text', youtube: url })
		expect(wrapper.get('.video-player').attributes('data-plyr-embed-id')).toBe(
			expected
		)
	})

	it('renders a {{ YouTubeVideo }} block as the same tracked markup', () => {
		const wrapper = mountContent({
			content: '{{ YouTubeVideo("https://www.youtube.com/watch?v=vid12345") }}',
		})

		const player = wrapper.get('.video-player')
		expect(player.attributes('data-plyr-provider')).toBe('youtube')
		expect(player.attributes('data-plyr-embed-id')).toBe('vid12345')
		expect(wrapper.find('iframe.youtube-video').exists()).toBe(false)
	})

	it('accepts a bare video id in the macro argument', () => {
		const wrapper = mountContent({ content: '{{ YouTubeVideo("vid12345") }}' })
		expect(wrapper.get('.video-player').attributes('data-plyr-embed-id')).toBe(
			'vid12345'
		)
	})

	it('renders nothing for a malformed macro rather than an empty player', () => {
		// An empty-id player would still count as a video and suppress the dwell
		// timer, leaving the lesson uncompletable.
		const wrapper = mountContent({ content: '{{ YouTubeVideo() }}' })
		expect(wrapper.find('.video-player').exists()).toBe(false)
	})

	it('renders no player when the lesson has no youtube field', () => {
		const wrapper = mountContent({ content: 'Just some prose.' })
		expect(wrapper.find('.video-player').exists()).toBe(false)
	})
})

describe('enforce_video_completion gates youtube-field lessons', () => {
	beforeEach(() => {
		plyrCtor.mockClear()
		document.body.innerHTML = ''
	})

	// Mirrors Lesson.vue: hasVideoListener = plyr instances || a <video> element.
	const hasVideoListener = (plyrSources: unknown[]) =>
		plyrSources.length > 0 || !!document.querySelector('video')

	it('suppresses the dwell timer for a youtube-field lesson', async () => {
		mountContent({
			content: 'Watch this.',
			youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		})

		const plyrSources = await enablePlyr()

		expect(plyrSources).toHaveLength(1)
		expect(
			shouldStartDwellTimer({
				hasVideo: hasVideoListener(plyrSources),
				enforceVideo: 1,
			})
		).toBe(false)
	})

	it('suppresses the dwell timer for a {{ YouTubeVideo }} lesson', async () => {
		mountContent({
			content: '{{ YouTubeVideo("https://www.youtube.com/watch?v=vid12345") }}',
		})

		const plyrSources = await enablePlyr()

		expect(plyrSources).toHaveLength(1)
		expect(
			shouldStartDwellTimer({
				hasVideo: hasVideoListener(plyrSources),
				enforceVideo: 1,
			})
		).toBe(false)
	})

	it('still runs the dwell timer for a lesson with no video at all', async () => {
		mountContent({ content: 'Just some prose.' })

		const plyrSources = await enablePlyr()

		expect(plyrSources).toHaveLength(0)
		expect(
			shouldStartDwellTimer({
				hasVideo: hasVideoListener(plyrSources),
				enforceVideo: 1,
			})
		).toBe(true)
	})

	// Lesson.vue reuses LessonContent across lessons (no :key on it) and resets
	// plyrSources before re-running enablePlyr. Since Plyr detaches the node it
	// initialises, an unkeyed player element leaves Vue patching a node that is
	// no longer in the document: the next lesson keeps showing the previous
	// video AND enablePlyr finds nothing, so the dwell timer is not suppressed
	// and the lesson auto-completes — the exact bug this component was changed
	// to fix.
	it('tracks the next lesson after navigating between two youtube-field lessons', async () => {
		const wrapper = mountContent({
			content: 'Lesson A',
			youtube: 'https://www.youtube.com/watch?v=AAAAAAAAAAA',
		})

		expect(await enablePlyr()).toHaveLength(1)

		await wrapper.setProps({
			content: 'Lesson B',
			youtube: 'https://www.youtube.com/watch?v=BBBBBBBBBBB',
		})

		const plyrSources = await enablePlyr()

		expect(document.body.innerHTML).not.toContain('AAAAAAAAAAA')
		expect(plyrSources).toHaveLength(1)
		expect(
			shouldStartDwellTimer({
				hasVideo: hasVideoListener(plyrSources),
				enforceVideo: 1,
			})
		).toBe(false)
	})
})
