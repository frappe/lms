import { describe, expect, it, vi } from 'vitest'

const { openFileSelector } = vi.hoisted(() => ({
	openFileSelector: vi.fn(),
}))

// Stub FileUploader so we can read the flat props it receives.
vi.mock('frappe-ui', async () => {
	const { h } = await import('vue')
	type Slots = import('vue').SetupContext['slots']
	return {
		Button: {
			name: 'Button',
			emits: ['click'],
			setup(_: unknown, { slots, emit }: any) {
				return () =>
					h('button', { onClick: () => emit('click') }, slots.default?.())
			},
		},
		ErrorMessage: {
			name: 'ErrorMessage',
			props: ['message'],
			setup(props: { message?: string }) {
				return () => h('p', { class: 'error-message' }, props.message ?? '')
			},
		},
		FileUploader: {
			name: 'FileUploader',
			props: [
				'private',
				'doctype',
				'docname',
				'fieldname',
				'fileTypes',
				'validateFile',
			],
			setup(_: unknown, { slots }: { slots: Slots }) {
				return () =>
					h(
						'div',
						{ class: 'file-uploader' },
						slots.default?.({
							openFileSelector,
							uploading: false,
							progress: 0,
							error: null,
						})
					)
			},
		},
	}
})

import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import UploadPlugin from '@/components/UploadPlugin.vue'
import translationPlugin from '@/translation'

const mountPlugin = (uploadContext: any) => {
	;(window as any).translatedMessages = {}
	return mount(UploadPlugin, {
		props: { onFileUploaded: () => {}, uploadContext },
		global: { plugins: [translationPlugin] },
	})
}

const uploader = (wrapper: any) =>
	wrapper.findComponent({ name: 'FileUploader' })

describe('UploadPlugin: attach args', () => {
	it('is always private and omits doctype/docname when the lesson has no docname yet', () => {
		const wrapper = mountPlugin({ docname: null, fieldname: 'content' })
		const u = uploader(wrapper)
		expect(u.props('private')).toBe(true)
		expect(u.props('doctype')).toBeUndefined()
		expect(u.props('docname')).toBeUndefined()
	})

	it('attaches to the lesson when a docname is present', () => {
		const wrapper = mountPlugin({
			docname: 'lesson-123',
			fieldname: 'content',
		})
		const u = uploader(wrapper)
		expect(u.props('doctype')).toBe('Course Lesson')
		expect(u.props('docname')).toBe('lesson-123')
		expect(u.props('fieldname')).toBe('content')
	})

	it('picks up a docname set on the live context after mount (lazy read)', async () => {
		const context = reactive({
			docname: null as string | null,
			fieldname: 'content',
		})
		const wrapper = mountPlugin(context)
		expect(uploader(wrapper).props('docname')).toBeUndefined()

		context.docname = 'lesson-456'
		await nextTick()

		const u = uploader(wrapper)
		expect(u.props('doctype')).toBe('Course Lesson')
		expect(u.props('docname')).toBe('lesson-456')
	})
})

describe('UploadPlugin: what a lesson accepts', () => {
	const check = (name: string) =>
		uploader(mountPlugin({ docname: null, fieldname: 'content' })).props(
			'validateFile'
		)({ name })

	it('takes the audio files phones and recorders save', () => {
		for (const name of [
			'talk.mp3',
			'memo.M4A',
			'clip.wav',
			'clip.ogg',
			'clip.aac',
		])
			expect(check(name)).toBeUndefined()
	})

	it('refuses a file it cannot show', () => {
		expect(check('notes.docx')).toBe(
			'Upload an image, video, audio or PDF file.'
		)
	})
})
