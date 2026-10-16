import { describe, expect, it, vi } from 'vitest'

// Stub FileUploader so we can read the flat props it receives.
vi.mock('frappe-ui', () => ({
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
		template: '<div class="file-uploader" />',
	},
}))

import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import UploadPlugin from '@/components/UploadPlugin.vue'

const mountPlugin = (uploadContext: any) =>
	mount(UploadPlugin, {
		props: { onFileUploaded: () => {}, uploadContext },
		global: { mocks: { __: (s: string) => s } },
	})

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
