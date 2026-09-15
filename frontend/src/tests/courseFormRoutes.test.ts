import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// vue-router resolves a matched record's async `component()` as part of
// navigation itself (to extract in-component guards), before this test ever
// asks what the current route is. The real page SFCs pull in frappe-ui, whose
// ESM build does not resolve under plain Node module resolution, so the page
// components are stubbed. The route TABLE under test is still the genuine one
// from `@/routes`.
// HeaderButton wraps frappe-ui's Button in a Tooltip below the mobile
// breakpoint, and the hand-written frappe-ui mock here has no Tooltip. Stub it
// down to the bare button so the fallthrough attrs the assertions use
// (data-testid, the click handler) still land where they did before.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs" />`,
	},
}))

vi.mock('@/pages/Courses/Courses.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/NewCourseForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/CourseImportForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Courses/CourseDetail.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/CourseEnrollmentForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

// The REAL route table, not a copy of it. A test that reimplements the routes
// only proves vue-router ranks static above dynamic — it would stay green while
// the route table said something else entirely.
import { routes } from '@/routes'

const router = () => createRouter({ history: createMemoryHistory(), routes })

describe('the course form routes', () => {
	it('resolves /courses/new to the form, not to a course named "new"', async () => {
		const r = router()
		await r.push('/courses/new')
		expect(r.currentRoute.value.name).toBe('NewCourse')
	})

	it('resolves /courses/import to the import form, not to a course named "import"', async () => {
		const r = router()
		await r.push('/courses/import')
		expect(r.currentRoute.value.name).toBe('CourseImport')
	})

	it('still resolves an ordinary course name to the detail page', async () => {
		const r = router()
		await r.push('/courses/rest-api-basics')
		expect(r.currentRoute.value.name).toBe('CourseDetail')
		expect(r.currentRoute.value.params.courseName).toBe('rest-api-basics')
	})

	it('keeps both forms nested under the list so the list stays mounted', async () => {
		const r = router()
		await r.push('/courses/new')
		expect(r.currentRoute.value.matched.map((m) => m.name)).toEqual([
			'Courses',
			'NewCourse',
		])

		await r.push('/courses/import')
		expect(r.currentRoute.value.matched.map((m) => m.name)).toEqual([
			'Courses',
			'CourseImport',
		])
	})

	it('resolves the enrollment form nested under the course it enrolls into', async () => {
		const r = router()
		await r.push('/courses/rest-api-basics/enrollment/new')
		expect(r.currentRoute.value.name).toBe('NewCourseEnrollment')
		expect(r.currentRoute.value.params.courseName).toBe('rest-api-basics')
		// Nested, so CourseDetail stays mounted behind the form — that is what
		// makes dialog-over-page work on desktop.
		expect(r.currentRoute.value.matched.map((m) => m.name)).toEqual([
			'CourseDetail',
			'NewCourseEnrollment',
		])
	})

	it('does not swallow a course whose name starts with "enrollment"', async () => {
		const r = router()
		await r.push('/courses/enrollment-policy')
		expect(r.currentRoute.value.name).toBe('CourseDetail')
		expect(r.currentRoute.value.params.courseName).toBe('enrollment-policy')
	})
})
