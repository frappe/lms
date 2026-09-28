// Guards every lesson embed being drawn as a rounded, outlined card, on the
// visible wrapper since Plyr replaces the element. Came with this branch's
// lesson embed rounding; added on feat/assessment-visual-redesign.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { onDisk } from '@/tests/helpers/designTokens'

vi.mock('@/utils/pdfViewer', () => ({ usesWebkitPdfViewer: () => false }))
vi.mock('@/components/PdfBlock.vue', () => ({
	default: defineComponent({ render: () => h('div', { class: 'pdf-block' }) }),
}))
vi.mock('@/components/QuizBlock.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Quiz.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Modals/QuizInVideo.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('frappe-ui', () => {
	const passthrough = defineComponent({
		setup:
			(_p, { slots }) =>
			() =>
				h('div', slots.default?.()),
	})
	return {
		Button: passthrough,
		Dialog: passthrough,
		Dropdown: passthrough,
		call: vi.fn(),
		createResource: vi.fn(() => ({})),
	}
})

import { Upload } from '@/utils/upload'
import VideoBlock from '@/components/VideoBlock.vue'
import AudioBlock from '@/components/AudioBlock.vue'
import LessonContent from '@/components/LessonContent.vue'

// Mirrors translation.js: a message with {0} returns a { format } object.
const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (_match, index) =>
				String(args[Number(index)])
			),
	}
}

const CARD = ['rounded-7', 'overflow-hidden', 'border', 'border-outline-gray-2']

const expectCard = (element: Element | null | undefined) => {
	expect(element, 'the embed renders').toBeTruthy()
	for (const name of CARD) expect(element!.classList).toContain(name)
}

const renderUpload = (file_url: string, file_type: string) => {
	const tool = new Upload({ data: { file_url, file_type }, readOnly: true })
	const wrapper = tool.render()
	document.body.append(wrapper)
	return wrapper
}

afterEach(() => {
	document.body.replaceChildren()
})

describe('the upload block in a lesson', () => {
	it('frames a PDF in a rounded card with lesson spacing', () => {
		const wrapper = renderUpload('/files/brief.pdf', 'PDF')

		expect(wrapper.classList).toContain('not-prose')
		expect(wrapper.classList).toContain('my-5')
		const frame = wrapper.querySelector('iframe')
		expectCard(frame?.parentElement)
		expect(frame?.classList).toContain('block')
	})

	it('rounds an uploaded image', () => {
		const wrapper = renderUpload('/files/diagram.png', 'PNG')

		expectCard(wrapper.querySelector('img'))
	})

	it('keeps lesson spacing on a video', () => {
		const wrapper = renderUpload('/files/intro.mp4', 'mp4')

		expect(wrapper.classList).toContain('not-prose')
		expect(wrapper.classList).toContain('my-5')
	})
})

describe('the media players', () => {
	// Both players read their media element on a timer after mount, so the
	// timer runs before unmount rather than against a detached component.
	const mountPlayer = (component: Component, props: Record<string, unknown>) =>
		mount(component, {
			props,
			attachTo: document.body,
			global: { mocks: { __: translate } },
		})

	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it('rounds the video player', async () => {
		const wrapper = mountPlayer(VideoBlock, {
			file: '/files/intro.mp4',
			readOnly: true,
			quizzes: [],
		})
		await flushPromises()

		expectCard(wrapper.find('.video-block').element)
		vi.runOnlyPendingTimers()
		wrapper.unmount()
	})

	it('rounds the audio player', () => {
		const wrapper = mountPlayer(AudioBlock, { file: '/files/talk.mp3' })

		expectCard(wrapper.find('[data-testid="audio-player"]').element)
		vi.runOnlyPendingTimers()
		wrapper.unmount()
	})

	it("rounds the inline PDF viewer's own frame", () => {
		const css = onDisk('components/PdfBlock.vue')
		const rule = css.slice(css.indexOf('.pdf-block {'))
		expect(rule.slice(0, rule.indexOf('}'))).toContain(
			'border-radius: var(--radius-7)'
		)
	})
})

describe('EditorJS embeds and images', () => {
	const css = onDisk('styles/blockEditor.css')
	const ruleFor = (selector: string) => {
		const at = css.indexOf(`${selector} {`)
		expect(at, `${selector} is styled`).toBeGreaterThanOrEqual(0)
		return css.slice(at, css.indexOf('}', at))
	}

	it.each(['.embed-tool', '.cdx-simple-image__picture'])(
		'%s is clipped to a rounded, outlined card',
		(selector) => {
			const rule = ruleFor(selector)
			expect(rule).toContain('border-radius: var(--radius-7)')
			expect(rule).toContain('overflow: hidden')
			expect(rule).toContain('border: 1px solid var(--outline-gray-2)')
		}
	)
})

describe('markdown lesson embeds', () => {
	const content = [
		"{{ YouTubeVideo('https://www.youtube.com/watch?v=abc123') }}",
		"{{ Video('/files/intro.mp4') }}",
		"{{ PDF('/files/brief.pdf') }}",
		"{{ Audio('/files/talk.mp3') }}",
		"{{ Embed('https://example.com/widget') }}",
	].join('\n\n')

	it.each([
		['YouTube', '.video-player'],
		['video', 'video'],
		['PDF', 'iframe[type="application/pdf"]'],
		['audio', 'audio'],
		['embed', 'iframe[title="Embedded content"]'],
	])('rounds the %s embed', (_name, selector) => {
		const wrapper = mount(LessonContent, {
			props: { content },
			global: { mocks: { __: (text: string) => text } },
		})

		expectCard(wrapper.find(selector).element.parentElement)
		wrapper.unmount()
	})
})
