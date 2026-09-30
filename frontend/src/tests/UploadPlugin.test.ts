import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openFileSelector, slotState } = vi.hoisted(() => ({
	openFileSelector: vi.fn(),
	slotState: {
		uploading: false,
		progress: 0,
		error: null as string | null,
	},
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
						slots.default?.({ openFileSelector, ...slotState })
					)
			},
		},
	}
})

import { flushPromises, mount } from '@vue/test-utils'
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

describe('UploadPlugin: file picker', () => {
	beforeEach(() => {
		openFileSelector.mockClear()
		Object.assign(slotState, { uploading: false, progress: 0, error: null })
	})

	it('opens the file selector once through the slot prop on mount', async () => {
		mountPlugin({ docname: null, fieldname: 'content' })
		await flushPromises()
		expect(openFileSelector).toHaveBeenCalledTimes(1)
	})

	it('keeps an upload button to reopen a cancelled picker', async () => {
		const wrapper = mountPlugin({ docname: null, fieldname: 'content' })
		await flushPromises()
		const button = wrapper.find('button')
		expect(button.text()).toBe('Upload File')
		await button.trigger('click')
		expect(openFileSelector).toHaveBeenCalledTimes(2)
	})

	it('shows upload progress', async () => {
		Object.assign(slotState, { uploading: true, progress: 42 })
		const wrapper = mountPlugin({ docname: null, fieldname: 'content' })
		await flushPromises()
		expect(wrapper.find('button').text()).toBe('Uploading 42%')
	})

	it('shows the validation error', async () => {
		slotState.error = 'Only image and video files are allowed.'
		const wrapper = mountPlugin({ docname: null, fieldname: 'content' })
		await flushPromises()
		expect(wrapper.find('.error-message').text()).toBe(
			'Only image and video files are allowed.'
		)
	})
})
