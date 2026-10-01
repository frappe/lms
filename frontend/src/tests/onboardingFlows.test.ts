/**
 * The flow registry. Step order is frozen once shipped, because the framework
 * matches stored progress to steps by index.
 */
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
	it('ships five flows with their framework keys', () => {
		expect(FLOWS.map((f) => [f.id, f.key])).toEqual([
			['publish_course', 'learning_publish_course'],
			['onboard_learners_invite', 'learning_onboard_learners_invite'],
			['onboard_learners_csv', 'learning_onboard_learners_csv'],
			['live_class_zoom', 'learning_live_class_zoom'],
			['live_class_meet', 'learning_live_class_meet'],
		])
	})

	it('groups them into three cards with the design copy', () => {
		expect(CARDS.map((c) => [c.id, c.title, c.description])).toEqual([
			[
				'publish_course',
				'Publish my first course',
				'Set up your first course and lessons.',
			],
			[
				'onboard_learners',
				'Onboard my existing learners',
				'Bring your learners into a batch.',
			],
			[
				'live_class',
				'Run my first live class',
				'Connect a meeting account and schedule a class.',
			],
		])
	})

	it('asks how learners are added', () => {
		const q = getCard('onboard_learners')!.question!
		expect([q.label, q.title]).toEqual([
			'Learner source',
			'How will you add learners?',
		])
		expect(q.options.map((o) => [o.label, o.description, o.flow.id])).toEqual([
			[
				'Import a CSV',
				'Upload a spreadsheet of learners.',
				'onboard_learners_csv',
			],
			[
				'Invite by email',
				'Send invites and let learners sign up.',
				'onboard_learners_invite',
			],
		])
	})

	it('asks which meeting tool', () => {
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

	it('publish course has no question', () => {
		expect(getCard('publish_course')!.question).toBeUndefined()
	})

	it('resolves a card to its answer’s flow', () => {
		const live = getCard('live_class')!
		expect(flowForAnswer(live, 'meet')?.id).toBe('live_class_meet')
		expect(flowForAnswer(live, null)).toBeNull()
		expect(flowForAnswer(live, 'teams')).toBeNull()
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
				'Add a quiz',
				'Set pricing',
				'Publish the course',
			],
		},
		{
			id: 'onboard_learners_invite',
			titles: [
				'Create a batch',
				'Invite learners by email',
				'Add a course to the batch',
				'Publish the batch',
			],
		},
		{
			id: 'onboard_learners_csv',
			titles: [
				'Create a batch',
				'Import learners from CSV',
				'Add a course to the batch',
				'Publish the batch',
			],
		},
		{
			id: 'live_class_zoom',
			titles: [
				'Create a batch',
				'Connect a Zoom account',
				'Schedule a live class',
				'Publish the batch',
			],
		},
		{
			id: 'live_class_meet',
			titles: [
				'Create a batch',
				'Set up Google API',
				'Connect Google Calendar',
				'Add a Google Meet account',
				'Schedule a live class',
				'Publish the batch',
			],
		},
	])('$id keeps its step order', ({ id, titles }) => {
		expect(stepsOf(id).map((s) => s.title)).toEqual(titles)
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
		expect(getFlow('live_class')).toBeUndefined()
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
		{ name: 'create_first_chapter', hash: '#editor' },
		{ name: 'create_first_lesson', hash: '#editor' },
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

	it('falls back to the course list without a first course', () => {
		const nav = fakeNav()
		click('publish_course', 'create_first_chapter', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({ name: 'Courses' })
	})

	it.each([
		{ name: 'create_first_course', to: { name: 'NewCourse' }, via: 'openForm' },
		{ name: 'add_quiz', to: { name: 'NewQuiz' }, via: 'openRoute' },
	] as const)('$name opens $to.name', ({ name, to, via }) => {
		const nav = fakeNav()
		click('publish_course', name, nav)
		expect(nav[via]).toHaveBeenCalledWith(to)
	})

	it('opens the data import for batch enrolments to import learners', () => {
		const nav = fakeNav(facts)
		click('onboard_learners_csv', 'import_learners_csv', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'NewDataImport',
			params: { doctype: 'LMS Batch Enrollment' },
		})
	})

	it.each([
		{ id: 'onboard_learners_invite', name: 'invite_students', slug: 'members' },
		{ id: 'live_class_zoom', name: 'connect_zoom', slug: 'zoom' },
		{ id: 'live_class_meet', name: 'setup_google_api', slug: 'services' },
		{
			id: 'live_class_meet',
			name: 'connect_google_calendar',
			slug: 'google-calendar',
		},
		{ id: 'live_class_meet', name: 'add_meet_account', slug: 'google-meet' },
	])('$name opens the $slug settings page', ({ id, name, slug }) => {
		const nav = fakeNav()
		click(id, name, nav)
		expect(nav.openSettings).toHaveBeenCalledWith(slug)
	})

	it.each(
		['onboard_learners_invite', 'onboard_learners_csv', 'live_class_zoom'].map(
			(id) => ({ id })
		)
	)('$id opens the new batch form', ({ id }) => {
		const nav = fakeNav()
		click(id, 'create_first_batch', nav)
		expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewBatch' })
	})

	it.each([
		{
			id: 'onboard_learners_csv',
			name: 'add_batch_course',
			form: 'NewBatchCourse',
			hash: '#settings',
		},
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
