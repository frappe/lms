import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AudioBlock from '@/components/AudioBlock.vue'
import { audioMime, encodeLink, isAudioType } from '@/utils/audio'

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label'],
		emits: ['click'],
		template:
			'<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
	},
}))

String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_match: string, index: number) =>
		String(args[index]),
	)
}

const mountBlock = (file: string) =>
	mount(AudioBlock, {
		props: { file },
		attachTo: document.body,
		global: { mocks: { __: (value: string) => value } },
	})

describe('audio types', () => {
	it('plays the formats phones and recorders save', () => {
		for (const type of ['mp3', 'MP3', 'wav', 'ogg', 'm4a', 'aac'])
			expect(isAudioType(type)).toBe(true)
		expect(isAudioType('mp4')).toBe(false)
		expect(isAudioType('')).toBe(false)
	})

	it('declares each file by its own type, not always mp3', () => {
		expect(audioMime('/private/files/Broken Heart 1.mp3')).toBe('audio/mpeg')
		expect(audioMime('/files/voice note.m4a')).toBe('audio/mp4')
		expect(audioMime('/files/clip.WAV?fid=1')).toBe('audio/wav')
	})
})

describe('AudioBlock', () => {
	// A lesson with two clips: each player must drive its own file.
	it('plays its own clip when a lesson has two', async () => {
		const play = vi
			.spyOn(HTMLMediaElement.prototype, 'play')
			.mockImplementation(function (this: HTMLMediaElement) {
				return Promise.resolve()
			})
		vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(true)
		const first = mountBlock('/files/one.mp3')
		const second = mountBlock('/files/two.m4a')

		await second.find('button').trigger('click')

		expect(play.mock.contexts.at(-1)).toBe(second.find('audio').element)
		expect(second.find('source').attributes('type')).toBe('audio/mp4')
		first.unmount()
		second.unmount()
		vi.restoreAllMocks()
	})
})

describe('encodeLink', () => {
	it('encodes a raw link once and leaves an encoded one alone', () => {
		expect(encodeLink('/files/Broken Heart 1.mp3')).toBe(
			'/files/Broken%20Heart%201.mp3',
		)
		expect(encodeLink('https://cdn.example.com/Broken%20Heart.mp3')).toBe(
			'https://cdn.example.com/Broken%20Heart.mp3',
		)
	})
})
