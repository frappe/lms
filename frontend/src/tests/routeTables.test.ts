import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

// The REAL route table, not a copy of it. A test that reimplements the routes
// only proves vue-router ranks static above dynamic — it would stay green while
// the route table said something else entirely. One file, so @/routes and its
// page stubs load once.

vi.stubGlobal('__', (text: string) => text)

// Navigation imports each matched page SFC, so stub them; the route table
// from @/routes stays real.
// vi.hoisted: vi.mock's factory is hoisted above every top-level const, so a
// plain `const stub = …` referenced inside one throws.
const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/pages/Assignments.vue', stub)
vi.mock('@/pages/Forms/AssignmentForm.vue', stub)
vi.mock('@/pages/AssignmentSubmissions.vue', stub)
vi.mock('@/pages/AssignmentSubmission.vue', stub)
vi.mock('@/pages/Batches/Batches.vue', stub)
vi.mock('@/pages/Forms/NewBatchForm.vue', stub)
vi.mock('@/pages/Batches/BatchDetail.vue', stub)
vi.mock('@/pages/Forms/BulkCertificatesForm.vue', stub)
vi.mock('@/pages/Forms/LiveClassForm.vue', stub)
vi.mock('@/pages/Forms/AnnouncementForm.vue', stub)
vi.mock('@/pages/Forms/BatchCourseForm.vue', stub)
vi.mock('@/pages/Forms/AssessmentForm.vue', stub)
vi.mock('@/pages/Forms/BatchStudentForm.vue', stub)
vi.mock('@/pages/Forms/EmailTemplateForm.vue', stub)
vi.mock('@/pages/Courses/Courses.vue', stub)
vi.mock('@/pages/Forms/NewCourseForm.vue', stub)
vi.mock('@/pages/Forms/CourseImportForm.vue', stub)
vi.mock('@/pages/Courses/CourseDetail.vue', stub)
vi.mock('@/pages/Forms/CourseEnrollmentForm.vue', stub)
vi.mock('@/pages/Programs/Programs.vue', stub)
vi.mock('@/pages/Forms/ProgramForm.vue', stub)
vi.mock('@/pages/Programs/ProgramDetail.vue', stub)
vi.mock('@/pages/Programs/ProgramEnrollment.vue', stub)
vi.mock('@/pages/ProgrammingExercises/ProgrammingExercises.vue', stub)
vi.mock('@/pages/Forms/ProgrammingExerciseForm.vue', stub)
vi.mock('@/pages/ProgrammingExercises/ProgrammingExerciseSubmissions.vue', stub)
vi.mock('@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue', stub)

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

// useBatchForms imports createResource at module scope.
vi.mock('frappe-ui', () => ({
	createResource: vi.fn(() => ({
		data: null,
		loading: false,
		reload: vi.fn(),
	})),
}))

// This imports `@/routes` rather than `@/router`, which pulls in the stores and
// the navigation guard's server calls; the route table has none of that.
import { routes } from '@/routes'
import { batchRouteLocation, openBatchForm } from '@/composables/useBatchForms'

const makeRouter = (): Router =>
	createRouter({ history: createMemoryHistory(), routes })

const routerAt = async (path: string) => {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	return router
}

// Guards the assignment routes: forms under edit/, submissions in the namespace.
// The form route came in #2662; this branch's route moves reshaped the table.
// Added on feat/assessment-visual-redesign to match the quiz redesign's paths.
describe('the assignment route table', () => {
	it('addresses the create form at /assignments/new', async () => {
		const router = await routerAt('/assignments/new')
		expect(router.currentRoute.value.name).toBe('NewAssignment')
	})

	it('addresses an existing assignment under edit/', async () => {
		const router = await routerAt('/assignments/edit/ASG-0001')
		expect(router.currentRoute.value.name).toBe('AssignmentForm')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
	})

	it('keeps both forms nested under the list so the list stays mounted', async () => {
		const create = await routerAt('/assignments/new')
		expect(create.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'Assignments',
			'NewAssignment',
		])
		const edit = await routerAt('/assignments/edit/ASG-0001')
		expect(edit.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'Assignments',
			'AssignmentForm',
		])
	})

	it('leaves the bare list route with no form open', async () => {
		const router = await routerAt('/assignments')
		expect(router.currentRoute.value.name).toBe('Assignments')
		expect(router.currentRoute.value.matched).toHaveLength(1)
	})

	it('resolves the submissions list, not a form', async () => {
		const router = await routerAt('/assignments/submissions')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmissions')
	})

	// A docname is a slug of the title, so both of these are names an author
	// can produce. Without the edit/ segment their forms would be unreachable,
	// because vue-router scores a fixed word above a placeholder.
	it('gives the form an address no docname can shadow', async () => {
		for (const docname of ['submissions', 'new']) {
			const router = await routerAt(`/assignments/edit/${docname}`)
			expect(router.currentRoute.value.name).toBe('AssignmentForm')
			expect(router.currentRoute.value.params.assignmentID).toBe(docname)
		}
	})

	it('resolves a single submission outside the plural namespace', async () => {
		const router = await routerAt('/assignment-submission/ASG-0001/SUB-1')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmission')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
		expect(router.currentRoute.value.params.submissionName).toBe('SUB-1')
	})

	// :assignmentID cannot be dropped the way /quiz-submission/:submission
	// drops its quiz: on a first attempt there is no submission yet to read the
	// assignment off, and this is the address that attempt is written from.
	it('addresses a new submission for an assignment', async () => {
		const router = await routerAt('/assignment-submission/ASG-0001/new')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmission')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
		expect(router.currentRoute.value.params.submissionName).toBe('new')
	})
})

// Guards old assignment bookmarks and links still landing on the right page.
// Came with this branch's move of assignment routes under /assignments.
// Added on feat/assessment-visual-redesign so retired paths redirect.
describe('the retired assignment paths', () => {
	it('redirects the old form address onto edit/', async () => {
		const router = await routerAt('/assignments/ASG-0001?tab=details')
		expect(router.currentRoute.value.name).toBe('AssignmentForm')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
		expect(router.currentRoute.value.query.tab).toBe('details')
	})

	it('redirects the old submissions list and renames its filter key', async () => {
		const router = await routerAt('/assignment-submissions?assignmentID=ASG-1')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmissions')
		expect(router.currentRoute.value.query.assignment).toBe('ASG-1')
		expect(router.currentRoute.value.query.assignmentID).toBeUndefined()
	})

	it('passes an old submissions-list query through untouched otherwise', async () => {
		const router = await routerAt('/assignment-submissions?status=Pass')
		expect(router.currentRoute.value.query.status).toBe('Pass')
	})
})

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

describe('the new-batch route', () => {
	it('resolves /batches/new to the form, not to a batch named "new"', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push('/batches/new')
		expect(router.currentRoute.value.name).toBe('NewBatch')
	})

	it('still resolves an ordinary batch name to the detail page', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push('/batches/BATCH-0001')
		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.params.batchName).toBe('BATCH-0001')
	})

	it('keeps the form nested under the list so the list stays mounted', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push('/batches/new')
		const names = router.currentRoute.value.matched.map((r) => r.name)
		expect(names).toEqual(['Batches', 'NewBatch'])
	})
})

const push = async (path: string) => {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	return router.currentRoute.value
}

describe('the program form route', () => {
	// The whole reason the path carries `/edit`. A bare `:programName` child of
	// Programs would be byte-identical to the top-level ProgramDetail route and
	// score identically; vue-router keeps both and serves whichever was
	// registered first — the child — silently breaking every student-facing
	// program link. This test is the regression guard for that.
	it('leaves a bare program path with the student-facing detail page', async () => {
		const route = await push('/programs/data-science')
		expect(route.name).toBe('ProgramDetail')
		expect(route.params.programName).toBe('data-science')
	})

	it('resolves the /edit path to the form', async () => {
		const route = await push('/programs/data-science/edit')
		expect(route.name).toBe('ProgramForm')
		expect(route.params.programName).toBe('data-science')
	})

	it('carries the create sentinel in the same param', async () => {
		const route = await push('/programs/new/edit')
		expect(route.name).toBe('ProgramForm')
		expect(route.params.programName).toBe('new')
	})

	it('keeps the form nested under the list so the list stays mounted', async () => {
		const route = await push('/programs/data-science/edit')
		expect(route.matched.map((record) => record.name)).toEqual([
			'Programs',
			'ProgramForm',
		])
	})

	it('resolves the /enroll path to the enrollment page', async () => {
		const route = await push('/programs/data-science/enroll')
		expect(route.name).toBe('ProgramEnrollment')
		expect(route.params.programName).toBe('data-science')
	})

	it('keeps the enrollment page nested so the list keeps its tab', async () => {
		// StudentPrograms holds `currentTab` in a local ref, not the route. Being
		// a child is what keeps that component mounted, so cancelling returns to
		// the Published tab the student opened this from rather than resetting to
		// Enrolled.
		const route = await push('/programs/data-science/enroll')
		expect(route.matched.map((record) => record.name)).toEqual([
			'Programs',
			'ProgramEnrollment',
		])
	})

	it('registers exactly one route for a bare program path', async () => {
		// The shadowing in R1 is not a match-order accident that a single push
		// could miss: it is two records claiming one path. Assert the app has only
		// one, so re-adding a bare child fails here even if push() happened to
		// pick the right one.
		const router = createRouter({ history: createMemoryHistory(), routes })
		const claimants = router
			.getRoutes()
			.filter((record) => record.path === '/programs/:programName')
		expect(claimants.map((record) => record.name)).toEqual(['ProgramDetail'])
	})
})

// Guards the exercise paths resolving to the right pages. The edit/ route came
// with #2662; this branch's route realignment made both forms pages and moved
// submissions to /programming-exercise-submission, so the table was re-pinned.
describe('the programming-exercise route table', () => {
	it('resolves /programming-exercises/edit/:id to the form', async () => {
		const router = await routerAt('/programming-exercises/edit/EX-0001')
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseForm')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
	})

	it('addresses both forms as pages of their own', async () => {
		const create = await routerAt('/programming-exercises/new')
		expect(create.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'NewProgrammingExercise',
		])
		const edit = await routerAt('/programming-exercises/edit/EX-0001')
		expect(edit.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'ProgrammingExerciseForm',
		])
	})

	it('resolves the static submissions list, not a form', async () => {
		const router = await routerAt('/programming-exercises/submissions')
		expect(router.currentRoute.value.name).toBe(
			'ProgrammingExerciseSubmissions'
		)
	})

	it('resolves the bare list page', async () => {
		const router = await routerAt('/programming-exercises')
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})

	it('resolves a single submission outside the plural namespace', async () => {
		const router = await routerAt(
			'/programming-exercise-submission/EX-0001/SUB-1'
		)
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseSubmission')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
		expect(router.currentRoute.value.params.submissionID).toBe('SUB-1')
	})

	// Unlike /quiz-submission, :exerciseID stays: a first attempt has no
	// submission yet to read the exercise off.
	it('addresses a new submission for an exercise', async () => {
		const router = await routerAt(
			'/programming-exercise-submission/EX-0001/new'
		)
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseSubmission')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
		expect(router.currentRoute.value.params.submissionID).toBe('new')
	})
})

// Guards old submission links (emails, bookmarks) breaking after the move.
// Came with this branch's route realignment for the assessment redesign.
// Added on feat/assessment-visual-redesign to pin the redirect and its query.
describe('the retired programming-exercise paths', () => {
	it('redirects the old submission address, keeping its query', async () => {
		const router = await routerAt(
			'/programming-exercises/EX-0001/submission/SUB-1?fromLesson=1'
		)
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseSubmission')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
		expect(router.currentRoute.value.params.submissionID).toBe('SUB-1')
		expect(router.currentRoute.value.query.fromLesson).toBe('1')
	})
})
