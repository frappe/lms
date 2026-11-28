import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Button: {
		name: 'Button',
		props: ['label', 'route'],
		emits: ['click'],
		template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>',
	},
}))
vi.mock('@/components/VideoPreview.vue', () => ({
	default: {
		name: 'VideoPreview',
		props: ['videoLink', 'fallbackImage'],
		template: '<div />',
	},
}))
vi.mock('@/components/InlineEdit/VideoLinkDialog.vue', () => ({
	default: {
		name: 'VideoLinkDialog',
		props: ['open', 'modelValue'],
		emits: ['update:open', 'update:modelValue'],
		template: '<div />',
	},
}))

import CourseVideoField from '@/components/Courses/CourseVideoField.vue'

const mountField = (props: Record<string, unknown>) => {
	const wrapper = mount(CourseVideoField, {
		props: {
			...props,
			'onUpdate:videoLink': (value: string) =>
				wrapper.setProps({ videoLink: value }),
		},
		global: { mocks: { __: (text: string) => text } },
	})
	return wrapper
}

describe('the course video field', () => {
	it('shows the thumbnail read-only until a video is set, with Add preview video', () => {
		const wrapper = mountField({ tint: 'Teal', icon: 'rocket' })
		expect(wrapper.find('[data-testid="course-thumbnail"]').exists()).toBe(true)
		expect(wrapper.find('.lucide-rocket').exists()).toBe(true)
		expect(wrapper.get('[data-testid="video-button"]').text()).toBe(
			'Add preview video'
		)
		expect(wrapper.find('[aria-pressed]').exists()).toBe(false)
	})

	it('sets the video through its dialog and then shows it', async () => {
		const wrapper = mountField({ image: '/files/cover.png' })
		await wrapper.get('[data-testid="video-button"]').trigger('click')
		const dialog = wrapper.getComponent({ name: 'VideoLinkDialog' })
		expect(dialog.props('open')).toBe(true)
		await dialog.vm.$emit('update:modelValue', 'https://youtu.be/x')
		expect(wrapper.props('videoLink')).toBe('https://youtu.be/x')
		const preview = wrapper.getComponent({ name: 'VideoPreview' })
		expect(preview.props('fallbackImage')).toBe('/files/cover.png')
		expect(wrapper.get('[data-testid="video-button"]').text()).toBe(
			'Edit preview video'
		)
	})

	it('points to the thumbnail in Settings, where it is edited', () => {
		const wrapper = mountField({})
		const edit = wrapper
			.findAllComponents({ name: 'Button' })
			.find((button) => button.props('label') === 'Edit thumbnail')
		expect(edit!.props('route')).toEqual({
			hash: '#settings',
			query: { section: 'thumbnail' },
		})
	})
})
