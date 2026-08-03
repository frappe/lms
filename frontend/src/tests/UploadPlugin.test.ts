import { describe, expect, it, vi } from 'vitest'

// Stub FileUploader so we can read the uploadArgs it receives.
vi.mock('frappe-ui', () => ({
	FileUploader: {
		name: 'FileUploader',
		props: ['uploadArgs', 'fileTypes', 'validateFile'],
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

const args = (wrapper: any) =>
	wrapper.findComponent({ name: 'FileUploader' }).props('uploadArgs')

describe('UploadPlugin — uploadArgs', () => {
	it('omits doctype/docname when the lesson has no docname yet', () => {
		const wrapper = mountPlugin({ docname: null, fieldname: 'content' })
		const a = args(wrapper)
		expect(a.private).toBe(true)
		expect('doctype' in a).toBe(false)
		expect('docname' in a).toBe(false)
	})

	it('attaches to the lesson when a docname is present', () => {
		const wrapper = mountPlugin({
			docname: 'lesson-123',
			fieldname: 'content',
		})
		const a = args(wrapper)
		expect(a.doctype).toBe('Course Lesson')
		expect(a.docname).toBe('lesson-123')
		expect(a.fieldname).toBe('content')
	})

	it('picks up a docname set on the live context after mount (lazy read)', async () => {
		const context = reactive({ docname: null as string | null, fieldname: 'content' })
		const wrapper = mountPlugin(context)
		expect('docname' in args(wrapper)).toBe(false)

		context.docname = 'lesson-456'
		await nextTick()

		const a = args(wrapper)
		expect(a.doctype).toBe('Course Lesson')
		expect(a.docname).toBe('lesson-456')
	})
})
