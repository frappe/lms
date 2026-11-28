import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('@/pages/Courses/CoursePublishSettings.vue', () => ({
	default: { template: `<section data-title="Access" />` },
}))

import CourseForm from '@/pages/Courses/CourseForm.vue'

const group = {
	props: ['title', 'name'],
	template: `<section :data-title="title" :data-name="name"><slot /></section>`,
}

function mountForm() {
	const form = reactive({
		resource: { doc: { name: 'course-1', title: 'Course' } },
		meta: { description: '', keywords: '' },
		markDirty: vi.fn(),
	})
	return mount(CourseForm, {
		props: { course: { data: null } as never },
		global: {
			provide: { courseForm: form, $user: { data: {} } },
			stubs: {
				SettingsPage: { template: `<div><slot /></div>` },
				SettingsGroup: group,
				CourseThumbnailPicker: true,
				SettingField: true,
				SettingRow: true,
				SettingAction: true,
				SearchPreview: true,
			},
			mocks: { __: (text: string) => text },
		},
	})
}

describe('CourseForm sections', () => {
	it('opens with the Thumbnail section, before Access', () => {
		const titles = mountForm()
			.findAll('section')
			.map((section) => section.attributes('data-title'))
		expect(titles.slice(0, 2)).toEqual(['Thumbnail', 'Access'])
	})

	it('keeps the thumbnail section name for ?section=thumbnail links', () => {
		const first = mountForm().find('section')
		expect(first.attributes('data-name')).toBe('thumbnail')
	})
})
