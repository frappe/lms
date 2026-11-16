import { describe, expect, it } from 'vitest'
import LessonImage, { IMAGE_LINK } from '@/utils/lessonImage'

describe('pasted image links in a lesson', () => {
	it.each([
		'https://lms.b-cdn.net/hero.jpg',
		'https://lms.b-cdn.net/hero.webp?width=600',
		'https://imagedelivery.net/ZWd9g1K7eljCn_KDTu_MWA/083eb7b2-5392-4565-b69e-aff66acddd00/public',
		'https://school.example.com/cdn-cgi/imagedelivery/ZWd9g1K7eljCn_KDTu_MWA/083eb7b2/w=400,sharpen=3',
	])('turns %s into an image', (link) => {
		expect(IMAGE_LINK.test(link)).toBe(true)
	})

	it('leaves a page link as text', () => {
		expect(IMAGE_LINK.test('https://school.example.com/about')).toBe(false)
	})

	it('keeps the tags and files Simple Image already takes from a paste', () => {
		const config = LessonImage.pasteConfig
		expect(config.patterns.image).toBe(IMAGE_LINK)
		expect(config.tags).toBeTruthy()
	})
})
