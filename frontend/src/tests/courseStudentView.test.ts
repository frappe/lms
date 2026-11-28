import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)

const { mounts } = vi.hoisted(() => ({ mounts: { count: 0 } }))

vi.mock('@/components/StudentViewBar.vue', () => ({
	default: {
		props: ['modelValue', 'doctype', 'name'],
		emits: ['update:modelValue', 'exit', 'change'],
		template: `<div class="bar" :data-doctype="doctype" :data-name="name">
			<button class="enrolled" @click="$emit('update:modelValue', 'enrolled')" />
			<button class="change" @click="$emit('change')" />
			<button class="exit" @click="$emit('exit')" />
		</div>`,
	},
}))
vi.mock('@/pages/Courses/CourseOverview.vue', () => ({
	default: {
		props: ['course', 'preview'],
		emits: ['enroll'],
		created: () => mounts.count++,
		template: `<div class="overview" :data-preview="preview" @click="$emit('enroll')" />`,
	},
}))

vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: {
		props: ['breadcrumbs'],
		template: `<header class="page-header">{{ breadcrumbs.map((crumb) => crumb.label).join(' / ') }}</header>`,
	},
}))

import CourseStudentView from '@/components/Courses/CourseStudentView.vue'

const mountView = () => {
	const course = { data: { name: 'COURSE-1' }, reload: vi.fn() }
	const wrapper = mount(CourseStudentView, {
		props: {
			course: course as never,
			breadcrumbs: [{ label: 'Courses' }, { label: 'ERPNext' }],
		},
	})
	return { wrapper, course }
}

describe('CourseStudentView', () => {
	it('keeps the page header above the bar', () => {
		const { wrapper } = mountView()
		expect(wrapper.find('.page-header').text()).toBe('Courses / ERPNext')
	})

	it('drives the shared bar for this course', () => {
		const { wrapper } = mountView()
		expect(wrapper.find('.bar').attributes('data-doctype')).toBe('LMS Course')
		expect(wrapper.find('.bar').attributes('data-name')).toBe('COURSE-1')
		expect(wrapper.find('.overview').attributes('data-preview')).toBe(
			'not-enrolled'
		)
	})

	it("previews as enrolled from the overview's enroll button", async () => {
		const { wrapper } = mountView()
		await wrapper.find('.overview').trigger('click')
		expect(wrapper.find('.overview').attributes('data-preview')).toBe(
			'enrolled'
		)
	})

	it('reloads the course and remounts the overview after a change', async () => {
		const { wrapper, course } = mountView()
		const before = mounts.count
		await wrapper.find('.change').trigger('click')
		expect(course.reload).toHaveBeenCalledTimes(1)
		expect(mounts.count).toBe(before + 1)
	})

	it('passes exit up', async () => {
		const { wrapper } = mountView()
		await wrapper.find('.exit').trigger('click')
		expect(wrapper.emitted('exit')).toHaveLength(1)
	})
})
