import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const settings = vi.hoisted(() => ({
	data: { prevent_skipping_videos: 1 } as Record<string, unknown>,
}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({ settings }) }))
vi.mock('@/components/QuizBlock.vue', () => ({
	default: { props: ['quiz'], template: '<div />' },
}))
vi.mock('@/components/PdfBlock.vue', () => ({
	default: { props: ['file'], template: '<div />' },
}))

import LessonContent from '@/components/LessonContent.vue'
import VideoBlock from '@/components/VideoBlock.vue'

vi.stubGlobal('__', (s: string) => s)

const global = {
	mocks: { __: (s: string) => s },
	stubs: { Quiz: true, QuizInVideo: true, Dialog: true, Dropdown: true },
}

let wrapper: VueWrapper | undefined

beforeEach(() => (settings.data = { prevent_skipping_videos: 1 }))
afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	document.body.innerHTML = ''
})

// Regression from #1609 and #1898: the {{ Video }} macro had no skip guard and
// VideoBlock's slider refused any forward move. Added on fix/course-progress-enforcement (no PR yet).
describe('the {{ Video }} macro', () => {
	const mountMacro = () =>
		(wrapper = mount(LessonContent, {
			props: { content: '{{ Video("/files/intro.mp4") }}' },
			attachTo: document.body,
			global,
		}))

	it('snaps a seek from the native controls back to the watched point', () => {
		const video = mountMacro().get('video').element as HTMLVideoElement
		video.currentTime = 40
		video.dispatchEvent(new Event('seeking'))
		expect(video.currentTime).toBe(0)
	})
})

describe('VideoBlock', () => {
	const seekWithSlider = async (readOnly: boolean): Promise<number> => {
		wrapper = mount(VideoBlock, {
			props: { file: '/files/v.mp4', readOnly },
			attachTo: document.body,
			global,
		})
		await new Promise((resolve) => setTimeout(resolve))
		const slider = wrapper.get('input[type="range"]')
		;(slider.element as HTMLInputElement).max = '100'
		await slider.setValue('40')
		return (wrapper.get('video').element as HTMLVideoElement).currentTime
	}

	it('holds the slider at the furthest watched point', async () => {
		expect(await seekWithSlider(true)).toBe(0)
	})

	it('lets the instructor editing the block seek freely', async () => {
		expect(await seekWithSlider(false)).toBe(40)
	})
})
