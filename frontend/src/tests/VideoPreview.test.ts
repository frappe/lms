import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPreview from '@/components/VideoPreview.vue'

describe('VideoPreview', () => {
	it('renders a YouTube iframe (not a <video>) for a youtube link', () => {
		const w = mount(VideoPreview, {
			props: { videoLink: 'https://youtu.be/O7FIiYsVy3U?si=22FPigXQedh7jAlz' },
		})
		const iframe = w.find('iframe')
		expect(iframe.exists()).toBe(true)
		expect(iframe.attributes('src')).toBe(
			'https://www.youtube.com/embed/O7FIiYsVy3U'
		)
		expect(w.find('video').exists()).toBe(false)
	})

	it('renders a <video> for an uploaded file path', () => {
		const w = mount(VideoPreview, { props: { videoLink: '/files/intro.mp4' } })
		const video = w.find('video')
		expect(video.exists()).toBe(true)
		expect(video.attributes('src')).toBe('/files/intro.mp4')
		expect(w.find('iframe').exists()).toBe(false)
	})

	it('falls back to the image when the file video errors', async () => {
		const w = mount(VideoPreview, {
			props: { videoLink: '/files/intro.mov', fallbackImage: '/files/thumb.jpg' },
		})
		await w.find('video').trigger('error')
		expect(w.find('video').exists()).toBe(false)
		const img = w.find('img')
		expect(img.exists()).toBe(true)
		expect(img.attributes('src')).toBe('/files/thumb.jpg')
	})

	it('renders nothing without a link', () => {
		const w = mount(VideoPreview, { props: { videoLink: null } })
		expect(w.find('iframe').exists()).toBe(false)
		expect(w.find('video').exists()).toBe(false)
		expect(w.find('img').exists()).toBe(false)
	})
})
