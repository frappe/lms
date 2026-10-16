import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Plyr's YouTube provider REPLACES the element it is given —
// `player.media = replaceElement(container, player.media)` (plyr.mjs:5901), i.e.
// `oldChild.parentNode.replaceChild(newChild, oldChild)`, and the replacement
// carries no `video-player` class. The fake must do the same or the mock hides
// the class of bug where Vue keeps patching a node Plyr already detached.
const plyrCtor = vi.hoisted(() =>
	vi.fn(function FakePlyr(
		this: { on: () => void; elements: object },
		el: Element
	) {
		this.on = () => {}
		this.elements = {}
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

	it.each([
		{
			source: 'the youtube field',
			props: {
				content: 'Some intro text',
				youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			},
			id: 'dQw4w9WgXcQ',
		},
		{
			source: 'a {{ YouTubeVideo }} block',
			props: {
				content:
					'{{ YouTubeVideo("https://www.youtube.com/watch?v=vid12345") }}',
			},
			id: 'vid12345',
		},
	])(
		'renders $source as a .video-player, not a bare iframe',
		({ props, id }) => {
			const wrapper = mountContent(props)

			const player = wrapper.get('.video-player')
			expect(player.attributes('data-plyr-provider')).toBe('youtube')
			expect(player.attributes('data-plyr-embed-id')).toBe(id)
			expect(wrapper.find('iframe.youtube-video').exists()).toBe(false)
		}
	)

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
		vi.useFakeTimers()
	})
	afterEach(() => vi.useRealTimers())

	// enablePlyr waits 500ms for the content to settle before it scans.
	const runPlyr = async () => {
		const players = enablePlyr()
		await vi.advanceTimersByTimeAsync(500)
		return players
	}

	// Mirrors Lesson.vue: hasVideoListener = plyr instances || a <video> element.
	const hasVideoListener = (plyrSources: unknown[]) =>
		plyrSources.length > 0 || !!document.querySelector('video')

	it.each([
		{
			source: 'youtube-field',
			props: {
				content: 'Watch this.',
				youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			},
		},
		{
			source: '{{ YouTubeVideo }}',
			props: {
				content:
					'{{ YouTubeVideo("https://www.youtube.com/watch?v=vid12345") }}',
			},
		},
	])('suppresses the dwell timer for a $source lesson', async ({ props }) => {
		mountContent(props)

		const plyrSources = await runPlyr()

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

		const plyrSources = await runPlyr()

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

		expect(await runPlyr()).toHaveLength(1)

		await wrapper.setProps({
			content: 'Lesson B',
			youtube: 'https://www.youtube.com/watch?v=BBBBBBBBBBB',
		})

		const plyrSources = await runPlyr()

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
