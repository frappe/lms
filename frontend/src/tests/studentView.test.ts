/**
 * Tests for Student View — the lesson-editor preview that shows a course as a
 * learner sees it.
 *
 * The preview swapped in the real Lesson.vue but every component under it kept
 * injecting the real `$user`, whose `is_moderator` / `is_instructor` /
 * `is_evaluator` flags stay true. The visible consequence was Assignment.vue's
 * Grading panel: a moderator who submitted the assignment inside the preview
 * was immediately offered the Grade select and could grade themselves.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h, inject, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
	asStudent,
	provideStudentView,
	useStudentView,
} from '@/composables/useStudentView'

const MODERATOR = {
	name: 'mod@example.com',
	email: 'mod@example.com',
	full_name: 'Mod Erator',
	user_image: '/files/mod.png',
	is_moderator: true,
	is_instructor: true,
	is_evaluator: true,
	is_system_manager: true,
	is_student: false,
	roles: ['Moderator', 'Course Creator', 'Batch Evaluator', 'LMS Student'],
}

describe('asStudent', () => {
	it('flips every instructor flag off and marks the viewer a student', () => {
		const student = asStudent(MODERATOR) as Record<string, unknown>

		expect(student.is_moderator).toBe(false)
		expect(student.is_instructor).toBe(false)
		expect(student.is_evaluator).toBe(false)
		expect(student.is_system_manager).toBe(false)
		expect(student.is_student).toBe(true)
	})

	it('drops instructor roles but keeps the learner ones', () => {
		const student = asStudent(MODERATOR) as Record<string, unknown>

		expect(student.roles).toEqual(['LMS Student'])
	})

	it('passes every non-role field through untouched', () => {
		const student = asStudent(MODERATOR) as Record<string, unknown>

		expect(student.name).toBe(MODERATOR.name)
		expect(student.email).toBe(MODERATOR.email)
		expect(student.full_name).toBe(MODERATOR.full_name)
		expect(student.user_image).toBe(MODERATOR.user_image)
	})

	it('leaves a missing user alone', () => {
		expect(asStudent(null)).toBe(null)
		expect(asStudent(undefined)).toBe(undefined)
	})
})

// A stand-in for the components under the preview: it reads `$user` exactly the
// way Assignment.vue does and reports the same gate.
const GradingProbe = defineComponent({
	setup() {
		const user = inject<{ data?: Record<string, unknown> }>('$user')
		const isStudentView = useStudentView()
		return () =>
			h('div', [
				h(
					'span',
					{ 'data-testid': 'can-grade' },
					String(
						Boolean(
							user?.data?.is_moderator ||
								user?.data?.is_evaluator ||
								user?.data?.is_instructor
						)
					)
				),
				h(
					'span',
					{ 'data-testid': 'student-view' },
					String(isStudentView.value)
				),
				h('span', { 'data-testid': 'name' }, String(user?.data?.name ?? '')),
			])
	},
})

function mountUnderPreview(
	active: () => boolean,
	resource = { data: { ...MODERATOR } }
) {
	const Wrapper = defineComponent({
		setup() {
			provideStudentView(resource, active)
			return () => h(GradingProbe)
		},
	})
	return mount(Wrapper)
}

describe('provideStudentView', () => {
	it('leaves the real flags alone outside Student View', () => {
		const wrapper = mountUnderPreview(() => false)

		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('true')
		expect(wrapper.get('[data-testid="student-view"]').text()).toBe('false')
	})

	it('hides the grading gate inside Student View', () => {
		const wrapper = mountUnderPreview(() => true)

		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('false')
		expect(wrapper.get('[data-testid="student-view"]').text()).toBe('true')
	})

	it('still identifies the real user, so their own submission loads', () => {
		const wrapper = mountUnderPreview(() => true)

		expect(wrapper.get('[data-testid="name"]').text()).toBe(MODERATOR.email)
	})

	it('restores the real flags when the preview is turned off, without a remount', async () => {
		const active = ref(true)
		const wrapper = mountUnderPreview(() => active.value)
		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('false')

		active.value = false
		await wrapper.vm.$nextTick()

		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('true')
	})

	it('defaults to "not student view" when nothing provided it', () => {
		const Bare = defineComponent({ setup: () => () => h(GradingProbe) })
		const wrapper = mount(Bare, {
			global: { provide: { $user: { data: { ...MODERATOR } } } },
		})

		expect(wrapper.get('[data-testid="student-view"]').text()).toBe('false')
	})
})
