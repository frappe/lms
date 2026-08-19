import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

vi.stubGlobal('__', (text: string) => text)

// vue-router resolves a matched record's async component() during navigation
// itself, and the real SFCs pull in frappe-ui, whose ESM build does not resolve
// under plain Node module resolution (see newBatchRoute.test.ts). Stub the page
// components; the route TABLE under test is still the genuine one.
// vi.hoisted: vi.mock's factory is hoisted above every top-level const, so a
// plain `const stub = …` referenced inside one throws.
const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
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

vi.mock('@/pages/Batches/BatchDetail.vue', stub)
vi.mock('@/pages/Forms/BulkCertificatesForm.vue', stub)
vi.mock('@/pages/Forms/LiveClassForm.vue', stub)
vi.mock('@/pages/Forms/AnnouncementForm.vue', stub)
vi.mock('@/pages/Forms/BatchCourseForm.vue', stub)
vi.mock('@/pages/Forms/AssessmentForm.vue', stub)
vi.mock('@/pages/Forms/BatchStudentForm.vue', stub)
vi.mock('@/pages/Forms/EmailTemplateForm.vue', stub)

// useBatchForms imports createResource at module scope.
vi.mock('frappe-ui', () => ({
	createResource: vi.fn(() => ({
		data: null,
		loading: false,
		reload: vi.fn(),
	})),
}))

import { routes } from '@/routes'
import { batchRouteLocation, openBatchForm } from '@/composables/useBatchForms'

const makeRouter = (): Router =>
	createRouter({ history: createMemoryHistory(), routes })

describe('the batch-detail form routes', () => {
	it.each([
		['/batches/B1/certificates', 'BulkCertificates'],
		['/batches/B1/live-class/new', 'NewLiveClass'],
		['/batches/B1/announcement/new', 'NewAnnouncement'],
		['/batches/B1/course/new', 'NewBatchCourse'],
		['/batches/B1/assessment/new', 'NewAssessment'],
		['/batches/B1/student/new', 'NewBatchStudent'],
		['/batches/B1/email-template/new', 'NewBatchEmailTemplate'],
	])('resolves %s to %s, nested under BatchDetail', async (path, name) => {
		const router = makeRouter()
		await router.push(path)
		expect(router.currentRoute.value.name).toBe(name)
		expect(router.currentRoute.value.params.batchName).toBe('B1')
		// Nested, so the detail page stays mounted behind the form — that is
		// what makes dialog-over-page work on desktop.
		expect(router.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'BatchDetail',
			name,
		])
	})

	it('leaves the bare batch page matching only BatchDetail', async () => {
		const router = makeRouter()
		await router.push('/batches/B1')
		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.matched).toHaveLength(1)
	})

	it('carries the tab hash INTO the form route', async () => {
		// C2. BatchDetail derives its active tab from route.hash and pushes on
		// tab change; a form route that dropped the hash would re-render the
		// page on tab 0 behind the open form.
		const router = makeRouter()
		await router.push('/batches/B1#classes')
		await openBatchForm(router, 'NewLiveClass', 'B1', '#classes')
		expect(router.currentRoute.value.fullPath).toBe(
			'/batches/B1/live-class/new#classes'
		)
	})

	it('stamps the form-entry marker so close() can pop rather than replace', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#classes')
		await openBatchForm(router, 'BulkCertificates', 'B1', '#classes')
		expect(
			(router.options.history.state as Record<string, unknown>).lmsFormEntry
		).toBe(true)
	})

	it('goes back to the tab it was opened from', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#announcements')
		await openBatchForm(router, 'NewAnnouncement', 'B1', '#announcements')
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#announcements')
	})

	it('deep-links cold into the assessment form', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/assessment/new')

		expect(router.currentRoute.value.name).toBe('NewAssessment')
		expect(router.currentRoute.value.params.batchName).toBe('B1')
	})

	it('deep-links cold into the student-enrollment form', async () => {
		// No AdminBatchDashboard tab mounted to hand a batch resource or a
		// student list down, which is why the form owns its own insert.
		const router = makeRouter()
		await router.push('/batches/B1/student/new')

		expect(router.currentRoute.value.name).toBe('NewBatchStudent')
		expect(router.currentRoute.value.params.batchName).toBe('B1')
	})

	it('carries the dashboard tab hash through the student form', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#dashboard')
		await openBatchForm(router, 'NewBatchStudent', 'B1', '#dashboard')
		expect(router.currentRoute.value.fullPath).toBe(
			'/batches/B1/student/new#dashboard'
		)
	})

	it('deep-links cold into the batch-course form', async () => {
		// No BatchCourses tab mounted to hand a list down: the form has to stand
		// up on its own, which is why it owns its insert resource.
		const router = makeRouter()
		await router.push('/batches/B1/course/new')

		expect(router.currentRoute.value.name).toBe('NewBatchCourse')
		expect(router.currentRoute.value.params.batchName).toBe('B1')
	})

	it('carries the courses tab hash through the batch-course form', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#courses')
		await openBatchForm(router, 'NewBatchCourse', 'B1', '#courses')
		expect(router.currentRoute.value.fullPath).toBe(
			'/batches/B1/course/new#courses'
		)

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#courses')
	})

	it('carries the settings tab hash through the email-template form', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#settings')
		await openBatchForm(router, 'NewBatchEmailTemplate', 'B1', '#settings')
		expect(router.currentRoute.value.fullPath).toBe(
			'/batches/B1/email-template/new#settings'
		)

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#settings')
	})

	it('builds every batch-form location through one helper', () => {
		expect(batchRouteLocation('BulkCertificates', 'B1', '#settings')).toEqual({
			name: 'BulkCertificates',
			params: { batchName: 'B1' },
			hash: '#settings',
		})
	})
})
