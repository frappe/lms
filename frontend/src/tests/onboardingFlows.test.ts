// The flow registry. Step order is frozen once shipped: the framework matches
// stored progress to steps by index.
import { describe, expect, it, vi } from 'vitest'
import {
	CARDS,
	FACT_KEYS,
	FLOWS,
	flowForAnswer,
	getCard,
	getFlow,
	type FlowNavigation,
	type OnboardingFacts,
} from '@/onboarding/flows'
import { targetFromQuery } from '@/utils/courseOutline'

function fakeNav(facts: Partial<OnboardingFacts> = {}): FlowNavigation {
	return {
		facts,
		openRoute: vi.fn(),
		openForm: vi.fn(),
		openSettings: vi.fn(),
		complete: vi.fn(),
	}
}

function stepsOf(id: string, nav = fakeNav()) {
	const flow = getFlow(id)
	if (!flow) throw new Error(`no flow ${id}`)
	return flow.steps(nav)
}

const flowRows = FLOWS.map((f) => ({ id: f.id }))

describe('flow registry', () => {
	it('ships six flows with their framework keys', () => {
		expect(FLOWS.map((f) => [f.id, f.key])).toEqual([
			['publish_course', 'learning_publish_course'],
			['add_assessments', 'learning_add_assessments'],
			['live_class', 'learning_live_class'],
			['live_class_zoom', 'learning_live_class_zoom'],
			['live_class_meet', 'learning_live_class_meet'],
			['onboard_learners', 'learning_onboard_learners'],
		])
	})

	it('groups them into four cards, assessments after the first course', () => {
		expect(CARDS.map((c) => [c.id, c.title, c.description])).toEqual([
			[
				'publish_course',
				'Publish my first course',
				'Set up your first course and lessons.',
			],
			[
				'add_assessments',
				'Add assessments',
				'Create a quiz, a programming exercise and an assignment, then add them to a lesson.',
			],
			[
				'live_class',
				'Run my first live class',
				'Create a batch, pick a meeting tool and schedule a class.',
			],
			[
				'onboard_learners',
				'Onboard existing users',
				'Set up email and bring your users in.',
			],
		])
	})

	it('asks nothing before onboarding users', () => {
		const card = getCard('onboard_learners')!
		expect(card.question).toBeUndefined()
		expect(card.flows.map((f) => f.id)).toEqual(['onboard_learners'])
	})

	it('offers the meeting tools as the live class choice', () => {
		const q = getCard('live_class')!.question!
		expect([q.label, q.title]).toEqual([
			'Meeting tool',
			'Which meeting tool do you use?',
		])
		expect(q.options.map((o) => [o.label, o.description, o.flow.id])).toEqual([
			['Zoom', 'Host classes from a Zoom account.', 'live_class_zoom'],
			[
				'Google Meet',
				'Set up Google API and Calendar, then a Meet account.',
				'live_class_meet',
			],
		])
	})

	it('runs the live class on its pre-choice flow until a tool is picked', () => {
		const live = getCard('live_class')!
		expect(flowForAnswer(live, null)?.id).toBe('live_class')
		expect(flowForAnswer(live, 'teams')?.id).toBe('live_class')
		expect(flowForAnswer(live, 'meet')?.id).toBe('live_class_meet')
	})

	it('starts every live class key with the same three steps', () => {
		const head = [
			'create_first_batch',
			'fill_batch_details',
			'choose_meeting_tool',
		]
		for (const id of ['live_class', 'live_class_zoom', 'live_class_meet'])
			expect(
				stepsOf(id)
					.slice(0, 3)
					.map((s) => s.name)
			).toEqual(head)
		expect(stepsOf('live_class')).toHaveLength(3)
	})

	it('marks the meeting tool step as the live class choice', () => {
		const choose = stepsOf('live_class')[2]
		expect(choose.chooses).toBe('live_class')
		expect(choose.fact).toBeUndefined()
	})

	it('publish course has no question', () => {
		expect(getCard('publish_course')!.question).toBeUndefined()
	})

	it('resolves a card without a question to its only flow', () => {
		expect(flowForAnswer(getCard('publish_course')!, null)?.id).toBe(
			'publish_course'
		)
	})

	it.each([
		{
			id: 'publish_course',
			titles: [
				'Create a course',
				'Add a chapter',
				'Add a lesson',
				'Set pricing',
				'Publish the course',
			],
		},
		{
			id: 'add_assessments',
			titles: [
				'Create a quiz',
				'Create a programming exercise',
				'Create an assignment',
				'Add an assessment to a lesson',
			],
		},
		{
			id: 'live_class',
			titles: [
				'Create a batch',
				'Fill in batch details',
				'Choose a meeting tool',
			],
		},
		{
			id: 'live_class_zoom',
			titles: [
				'Create a batch',
				'Fill in batch details',
				'Choose a meeting tool',
				'Connect a Zoom account',
				'Schedule a live class',
				'Publish the batch',
			],
		},
		{
			id: 'live_class_meet',
			titles: [
				'Create a batch',
				'Fill in batch details',
				'Choose a meeting tool',
				'Set up Google API',
				'Connect Google Calendar',
				'Add a Google Meet account',
				'Schedule a live class',
				'Publish the batch',
			],
		},
		{
			id: 'onboard_learners',
			titles: ['Set up email', 'Import users in bulk'],
		},
	])('$id keeps its step order', ({ id, titles }) => {
		expect(stepsOf(id).map((s) => s.title)).toEqual(titles)
	})

	it.each([
		{
			id: 'publish_course',
			actions: ['Create', 'Add', 'Add', 'Set', 'Publish'],
		},
		{ id: 'add_assessments', actions: ['Create', 'Create', 'Create', 'Add'] },
		{ id: 'live_class', actions: ['Create', 'Fill in', 'Choose'] },
		{
			id: 'live_class_zoom',
			actions: [
				'Create',
				'Fill in',
				'Choose',
				'Connect',
				'Schedule',
				'Publish',
			],
		},
		{
			id: 'live_class_meet',
			actions: [
				'Create',
				'Fill in',
				'Choose',
				'Set up',
				'Connect',
				'Add',
				'Schedule',
				'Publish',
			],
		},
		{ id: 'onboard_learners', actions: ['Set up', 'Import'] },
	])('$id gives every step a short action verb', ({ id, actions }) => {
		expect(stepsOf(id).map((s) => s.actionLabel)).toEqual(actions)
	})

	it.each(flowRows)('$id has unique step names', ({ id }) => {
		const names = stepsOf(id).map((s) => s.name)
		expect(new Set(names).size).toBe(names.length)
	})

	it.each(flowRows)('$id only depends on earlier steps', ({ id }) => {
		const steps = stepsOf(id)
		steps.forEach((step, index) => {
			if (!step.dependsOn) return
			expect(steps.slice(0, index).map((s) => s.name)).toContain(step.dependsOn)
		})
	})

	it.each(flowRows)('$id steps start incomplete with known facts', ({ id }) => {
		for (const step of stepsOf(id)) {
			expect(step.completed).toBe(false)
			if (step.fact) expect(FACT_KEYS).toContain(step.fact)
		}
	})

	it('the assessments flow builds on the quiz and needs room for its forms', () => {
		const steps = stepsOf('add_assessments')
		expect(
			steps.map((s) => [s.name, s.fact, s.dependsOn, s.minimizeOnOpen])
		).toEqual([
			['add_quiz', 'has_quiz', undefined, true],
			['add_programming_exercise', 'has_programming_exercise', undefined, true],
			['add_assignment', 'has_assignment', undefined, true],
			[
				'add_assessment_to_lesson',
				'has_assessment_in_lesson',
				'add_quiz',
				undefined,
			],
		])
		expect(stepsOf('publish_course').map((s) => s.name)).not.toContain(
			'add_quiz'
		)
	})

	it('offers assessments next once the first course is published', () => {
		expect(getCard('publish_course')!.next[0]).toBe('add_assessments')
	})

	it.each(CARDS.map((c) => ({ id: c.id })))(
		'$id offers only other known cards next',
		({ id }) => {
			const card = getCard(id)!
			expect(card.next.length).toBeGreaterThan(0)
			for (const next of card.next) {
				expect(next).not.toBe(id)
				expect(getCard(next)).toBeDefined()
			}
		}
	)

	it('chains the Google Meet set-up steps', () => {
		const steps = stepsOf('live_class_meet')
		const dependsOn = (name: string) =>
			steps.find((s) => s.name === name)?.dependsOn
		expect(dependsOn('connect_google_calendar')).toBe('setup_google_api')
		expect(dependsOn('add_meet_account')).toBe('connect_google_calendar')
	})

	it('reads an unknown id as undefined', () => {
		expect(getFlow('live_class_old')).toBeUndefined()
		expect(getCard(null)).toBeUndefined()
	})
})

describe('step targets', () => {
	const facts = { first_course: 'my-course', first_batch: 'my-batch' }

	function click(id: string, name: string, nav: FlowNavigation) {
		stepsOf(id, nav)
			.find((s) => s.name === name)
			?.onClick?.()
	}

	it.each([
		{ name: 'set_course_pricing', hash: '#settings' },
		{ name: 'publish_course', hash: '#settings' },
	])('$name opens the first course at $hash', ({ name, hash }) => {
		const nav = fakeNav(facts)
		click('publish_course', name, nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			hash,
		})
	})

	it('opens the new-chapter form on the first course', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'create_first_chapter', nav)
		expect(nav.openForm).toHaveBeenCalledWith({
			name: 'ChapterForm',
			params: { courseName: 'my-course', chapterName: 'new' },
			hash: '#editor',
		})
	})

	it("adds a lesson to the first chapter through the editor's own draft", () => {
		const nav = fakeNav({ ...facts, first_chapter: 'my-chapter' })
		click('publish_course', 'create_first_lesson', nav)
		const to = vi.mocked(nav.openRoute).mock.calls[0][0] as {
			query: Record<string, string>
		}
		expect(to).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			query: { editLesson: '1-new', draftChapter: 'my-chapter' },
			hash: '#editor',
		})
		expect(targetFromQuery(to.query, () => 'token')).toEqual({
			kind: 'draft',
			chapter: 'my-chapter',
			token: 'token',
		})
	})

	it('opens the course editor when the first chapter is not known yet', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'create_first_lesson', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			hash: '#editor',
		})
	})

	it.each([
		{ name: 'create_first_chapter' },
		{ name: 'create_first_lesson' },
		{ name: 'set_course_pricing' },
	])(
		'$name falls back to the course list without a first course',
		({ name }) => {
			const nav = fakeNav()
			click('publish_course', name, nav)
			expect(nav.openRoute).toHaveBeenCalledWith({ name: 'Courses' })
			expect(nav.openForm).not.toHaveBeenCalled()
		}
	)

	it('create_first_course opens NewCourse', () => {
		const nav = fakeNav()
		click('publish_course', 'create_first_course', nav)
		expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewCourse' })
	})

	it.each([
		{ name: 'add_quiz', to: { name: 'NewQuiz' }, via: 'openRoute' },
		{
			name: 'add_programming_exercise',
			to: { name: 'NewProgrammingExercise' },
			via: 'openRoute',
		},
		{ name: 'add_assignment', to: { name: 'NewAssignment' }, via: 'openForm' },
	] as const)('$name opens $to.name', ({ name, to, via }) => {
		const nav = fakeNav()
		click('add_assessments', name, nav)
		expect(nav[via]).toHaveBeenCalledWith(to)
	})

	it("adds an assessment in the course editor's open lesson", () => {
		const nav = fakeNav(facts)
		click('add_assessments', 'add_assessment_to_lesson', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			hash: '#editor',
		})
	})

	it('opens the data import for users to import them in bulk', () => {
		const nav = fakeNav()
		click('onboard_learners', 'import_learners', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'NewDataImport',
			params: { doctype: 'User' },
		})
	})

	it("opens the first batch's settings to fill in its details", () => {
		const nav = fakeNav(facts)
		click('live_class', 'fill_batch_details', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'BatchDetail',
			params: { batchName: 'my-batch' },
			hash: '#settings',
		})
	})

	it('onboards users through email set-up and a bulk import only', () => {
		const names = stepsOf('onboard_learners').map((s) => s.name)
		expect(names).toEqual(['setup_email', 'import_learners'])
	})

	it.each([
		{
			id: 'onboard_learners',
			name: 'setup_email',
			slug: 'email-accounts',
			record: 'new',
		},
		{
			id: 'live_class_zoom',
			name: 'connect_zoom',
			slug: 'zoom',
			record: 'new',
		},
		{
			id: 'live_class_meet',
			name: 'setup_google_api',
			slug: 'services',
			record: undefined,
		},
		{
			id: 'live_class_meet',
			name: 'connect_google_calendar',
			slug: 'google-calendar',
			record: 'new',
		},
		{
			id: 'live_class_meet',
			name: 'add_meet_account',
			slug: 'google-meet',
			record: 'new',
		},
	])('$name opens $slug settings at $record', ({ id, name, slug, record }) => {
		const nav = fakeNav()
		click(id, name, nav)
		const args = record ? [slug, record] : [slug]
		expect(nav.openSettings).toHaveBeenCalledWith(...args)
	})

	it.each(['live_class_zoom', 'live_class_meet'].map((id) => ({ id })))(
		'$id opens the new batch form',
		({ id }) => {
			const nav = fakeNav()
			click(id, 'create_first_batch', nav)
			expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewBatch' })
		}
	)

	it.each([
		{
			id: 'live_class_meet',
			name: 'schedule_live_class',
			form: 'NewLiveClass',
			hash: '#classes',
		},
	])('$name opens $form on the first batch', ({ id, name, form, hash }) => {
		const nav = fakeNav(facts)
		click(id, name, nav)
		expect(nav.openForm).toHaveBeenCalledWith({
			name: form,
			params: { batchName: 'my-batch' },
			hash,
		})
	})

	it('opens the first batch to publish it', () => {
		const nav = fakeNav(facts)
		click('live_class_zoom', 'publish_batch', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'BatchDetail',
			params: { batchName: 'my-batch' },
		})
	})

	it('falls back to the batch list without a first batch', () => {
		const nav = fakeNav()
		click('live_class_zoom', 'schedule_live_class', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({ name: 'Batches' })
	})
})
