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
			['live_class', 'learning_live_class'],
			['live_class_zoom', 'learning_live_class_zoom'],
			['live_class_meet', 'learning_live_class_meet'],
			['onboard_learners', 'learning_onboard_learners'],
		])
	})

	it('groups them into three cards in the persona order', () => {
		expect(CARDS.map((c) => [c.id, c.title, c.description])).toEqual([
			[
				'publish_course',
				'Publish my first course',
				'Set up your first course and lessons.',
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
				'Add a quiz',
				'Set pricing',
				'Publish the course',
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
			actions: ['Create', 'Add', 'Add', 'Add', 'Set', 'Publish'],
		},
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

	it('opens a new lesson in the first chapter in the course editor', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'create_first_lesson', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			query: { editLesson: '1-1' },
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

	it.each([
		{ name: 'create_first_course', to: { name: 'NewCourse' }, via: 'openForm' },
		{ name: 'add_quiz', to: { name: 'NewQuiz' }, via: 'openRoute' },
	] as const)('$name opens $to.name', ({ name, to, via }) => {
		const nav = fakeNav()
		click('publish_course', name, nav)
		expect(nav[via]).toHaveBeenCalledWith(to)
	})

	it('opens the data import for users to import them in bulk', () => {
		const nav = fakeNav()
		click('onboard_learners', 'import_learners', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'NewDataImport',
			params: { doctype: 'User' },
		})
	})

	it('opens the first batch’s settings to fill in its details', () => {
		const nav = fakeNav(facts)
		click('live_class', 'fill_batch_details', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'BatchDetail',
			params: { batchName: 'my-batch' },
			hash: '#settings',
		})
	})

	it('has no invitation steps for onboarding users', () => {
		const names = stepsOf('onboard_learners').map((s) => s.name)
		expect(names).not.toContain('add_learner')
		expect(names).not.toContain('invite_learners')
		expect(names).not.toContain('create_first_batch')
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
