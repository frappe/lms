import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot name="icon" /><slot /></button>' },
	Dropdown: {
		props: ['options'],
		template: `<div><slot /><button v-for="option in options" :key="option.label" data-testid="option" @click="option.onClick()">{{ option.label }}</button></div>`,
	},
}))

import CourseChaptersHeader from '@/components/Courses/CourseChaptersHeader.vue'

vi.stubGlobal('__', (text: string) => text)

const mountHeader = (count?: number, collapsible = false) =>
	mount(CourseChaptersHeader, {
		props: { count, collapsible },
		global: { mocks: { __: (text: string) => text } },
	})

const option = (wrapper: ReturnType<typeof mountHeader>, label: string) =>
	wrapper
		.findAll('[data-testid="option"]')
		.find((button) => button.text() === label)!

describe('CourseChaptersHeader', () => {
	it('folds the panel from its icon when collapsible, else draws a plain icon', async () => {
		const collapsible = mountHeader(8, true)
		const hide = collapsible.find('[data-testid="hide-chapters"]')
		expect(hide.find('.lucide-panel-right-close').exists()).toBe(true)
		await hide.trigger('click')
		expect(collapsible.emitted('hide')).toHaveLength(1)

		const fixed = mountHeader(8)
		expect(fixed.find('[data-testid="hide-chapters"]').exists()).toBe(false)
		expect(fixed.find('.lucide-panel-right').exists()).toBe(true)
	})

	it('shows the chapter count', () => {
		expect(mountHeader(8).find('[data-testid="chapters-count"]').text()).toBe(
			'8'
		)
		expect(mountHeader(0).find('[data-testid="chapters-count"]').exists()).toBe(
			false
		)
	})

	it('adds a chapter from the Add button and the menu', async () => {
		const wrapper = mountHeader(1)
		await wrapper.find('[data-testid="add-chapter"]').trigger('click')
		await option(wrapper, 'Chapter').trigger('click')
		expect(wrapper.emitted('add-chapter')).toHaveLength(2)
	})

	it('offers SCORM packages in the add menu', async () => {
		const wrapper = mountHeader(1)
		await option(wrapper, 'SCORM packages').trigger('click')
		expect(wrapper.emitted('upload-scorm')).toHaveLength(1)
	})
})
