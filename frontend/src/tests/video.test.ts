import { describe, expect, it } from 'vitest'
import { getYouTubeId, getVideoPreview, hasVideoContent } from '@/utils/video'

describe('getYouTubeId', () => {
	it('extracts the id from watch, short, embed and youtu.be links', () => {
		expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
			'dQw4w9WgXcQ'
		)
		expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
		expect(getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
			'dQw4w9WgXcQ'
		)
		expect(getYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
			'dQw4w9WgXcQ'
		)
	})

	it('extracts the id from a bare id or share fragment (legacy stored form)', () => {
		expect(getYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
		expect(getYouTubeId('dQw4w9WgXcQ?si=AbCdEf123')).toBe('dQw4w9WgXcQ')
		expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=AbCdEf123')).toBe(
			'dQw4w9WgXcQ'
		)
	})

	it('returns null for non-youtube or empty input', () => {
		expect(getYouTubeId('')).toBeNull()
		expect(getYouTubeId(null)).toBeNull()
		expect(getYouTubeId('/files/intro.mp4')).toBeNull()
		expect(getYouTubeId('intro.mp4')).toBeNull()
	})
})

describe('getVideoPreview', () => {
	it('classifies a youtube link as an embed', () => {
		expect(getVideoPreview('https://youtu.be/dQw4w9WgXcQ')).toEqual({
			type: 'youtube',
			src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
		})
	})

	it('classifies any other non-empty url as a file', () => {
		expect(getVideoPreview('/files/intro.mp4')).toEqual({
			type: 'file',
			src: '/files/intro.mp4',
		})
	})

	it('resolves a bare uploaded filename against /files/', () => {
		// Legacy data: the backend used to strip the /files/ prefix off uploaded
		// videos, leaving a bare filename that <video> would treat as relative.
		expect(getVideoPreview('VID-20200313-WA0046.mp4')).toEqual({
			type: 'file',
			src: '/files/VID-20200313-WA0046.mp4',
		})
	})

	it('leaves a private-files path and absolute URLs untouched', () => {
		expect(getVideoPreview('/private/files/intro.mp4').src).toBe(
			'/private/files/intro.mp4'
		)
		expect(getVideoPreview('https://cdn.example.com/intro.mp4').src).toBe(
			'https://cdn.example.com/intro.mp4'
		)
	})

	it('returns an empty preview for no url', () => {
		expect(getVideoPreview('')).toEqual({ type: null, src: '' })
	})
})

describe('hasVideoContent', () => {
	it('detects youtube/videos/body-macro/embed/upload', () => {
		expect(hasVideoContent({ youtube: 'https://youtu.be/x' })).toBe(true)
		expect(hasVideoContent({ videos: [{}] })).toBe(true)
		expect(hasVideoContent({ body: 'intro {{ Video("/f.mp4") }}' })).toBe(true)
		expect(
			hasVideoContent({ content: JSON.stringify({ blocks: [{ type: 'embed' }] }) })
		).toBe(true)
		expect(
			hasVideoContent({
				content: JSON.stringify({
					blocks: [{ type: 'upload', data: { file_type: 'mp4' } }],
				}),
			})
		).toBe(true)
	})

	it('returns false for text-only lessons and bad input', () => {
		expect(hasVideoContent(null)).toBe(false)
		expect(hasVideoContent({ body: 'just text' })).toBe(false)
		expect(
			hasVideoContent({
				content: JSON.stringify({ blocks: [{ type: 'paragraph' }] }),
			})
		).toBe(false)
		expect(hasVideoContent({ content: 'not json' })).toBe(false)
		expect(
			hasVideoContent({
				content: JSON.stringify({
					blocks: [{ type: 'upload', data: { file_type: 'pdf' } }],
				}),
			})
		).toBe(false)
	})
})
