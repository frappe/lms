/**
 * Tests for Student View: `?studentView=1` on the lesson route, which shows a
 * course as a learner sees it.
 *
 * The lesson page renders the same components for everyone, and each of them
 * injects the real `$user`, whose `is_moderator` / `is_instructor` /
 * `is_evaluator` flags stay true. The visible consequence was Assignment.vue's
 * Grading panel: a moderator who submitted the assignment in student view was
 * immediately offered the Grade select and could grade themselves.
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

/**
 * Lesson.vue now owns the shadow itself: it injects the app-wide `$user`,
 * calls provideStudentView on that, and binds the returned `mockedUser`. This
 * models that arrangement, including the "Editor view" gate reading the real
 * user through its own inject.
 */
const LessonStandIn = defineComponent({
	props: { studentViewQuery: { type: String, default: undefined } },
	setup(props) {
		const realUser = inject<{ data?: Record<string, unknown> }>('$user')!
		const { isStudentView, mockedUser } = provideStudentView(
			realUser,
			() => props.studentViewQuery === '1'
		)
		const user = mockedUser
		// The real user, not the shadow: this is what gates "Editor view".
		const ownInjected = inject<{ data?: Record<string, unknown> }>('$user')
		const selfInjectedFlag = useStudentView()
		return () =>
			h('div', [
				h(
					'span',
					{ 'data-testid': 'own-can-edit' },
					String(Boolean(ownInjected?.data?.is_moderator))
				),
				h(
					'span',
					{ 'data-testid': 'own-real-user' },
					String(Boolean(realUser.data?.is_moderator))
				),
				h(
					'span',
					{ 'data-testid': 'own-shadowed-user' },
					String(Boolean(user.data?.is_moderator))
				),
				h(
					'span',
					{ 'data-testid': 'own-student-view' },
					String(isStudentView.value)
				),
				h(
					'span',
					{ 'data-testid': 'own-self-injected' },
					String(selfInjectedFlag.value)
				),
				h(GradingProbe),
			])
	},
})

function mountLesson(studentViewQuery?: string) {
	return mount(LessonStandIn, {
		props: { studentViewQuery },
		global: { provide: { $user: { data: { ...MODERATOR } } } },
	})
}

describe('a component that provides Student View to itself', () => {
	it('shadows $user for its children when the query flag is on', () => {
		const wrapper = mountLesson('1')

		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('false')
		expect(wrapper.get('[data-testid="student-view"]').text()).toBe('true')
	})

	it('leaves its children on the real $user when the flag is off', () => {
		const wrapper = mountLesson(undefined)

		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('true')
		expect(wrapper.get('[data-testid="student-view"]').text()).toBe('false')
	})

	it('still injects the real $user itself, so the way back stays visible', () => {
		const wrapper = mountLesson('1')

		expect(wrapper.get('[data-testid="own-can-edit"]').text()).toBe('true')
		expect(wrapper.get('[data-testid="own-real-user"]').text()).toBe('true')
		expect(wrapper.get('[data-testid="own-shadowed-user"]').text()).toBe(
			'false'
		)
	})

	it('cannot read its own flag back through useStudentView', () => {
		const wrapper = mountLesson('1')

		expect(wrapper.get('[data-testid="own-student-view"]').text()).toBe('true')
		expect(wrapper.get('[data-testid="own-self-injected"]').text()).toBe(
			'false'
		)
	})

	it('flips the shadow when the query changes, without a remount', async () => {
		const wrapper = mountLesson(undefined)
		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('true')

		await wrapper.setProps({ studentViewQuery: '1' })
		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('false')

		await wrapper.setProps({ studentViewQuery: undefined })
		expect(wrapper.get('[data-testid="can-grade"]').text()).toBe('true')
	})
})
