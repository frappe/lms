// The flow registry. Step order is frozen once shipped: the framework matches
// stored progress to steps by index.
import { describe, expect, it, vi } from 'vitest'
import { FLOWS, getFlow } from '@/onboarding/flows'
import { CARDS, flowForAnswer, getCard } from '@/onboarding/cards'
import {
	FACT_KEYS,
	type FlowNavigation,
	type OnboardingFacts,
} from '@/onboarding/types'
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
	// Guards: a renamed or dropped flow key, which orphans the progress stored
	// under it. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the six keys.
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

	// Guards: the panel's cards losing a title or changing order. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the card list.
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

	// Guards: a question showing on the users card, which has one flow.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep that card question-free.
	it('asks nothing before onboarding users', () => {
		const card = getCard('onboard_learners')!
		expect(card.question).toBeUndefined()
		expect(card.flows.map((f) => f.id)).toEqual(['onboard_learners'])
	})

	// Guards: the meeting tool choice losing Zoom or Meet, or picking the wrong
	// flow. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the options.
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

	// Guards: an unknown or missing tool answer resolving to no flow.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep the pre-choice fallback.
	it('runs the live class on its pre-choice flow until a tool is picked', () => {
		const live = getCard('live_class')!
		expect(flowForAnswer(live, null)?.id).toBe('live_class')
		expect(flowForAnswer(live, 'teams')?.id).toBe('live_class')
		expect(flowForAnswer(live, 'meet')?.id).toBe('live_class_meet')
	})

	// Guards: the live class keys drifting apart before the tool is picked.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep their shared head.
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

	// Guards: the meeting tool step losing `chooses`, so the panel stops
	// asking. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the marker.
	it('marks the meeting tool step as the live class choice', () => {
		const choose = stepsOf('live_class')[2]
		expect(choose.chooses).toBe('live_class')
		expect(choose.fact).toBeUndefined()
	})

	// Guards: a question on the publish card blocking its only flow. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// keep it question-free.
	it('publish course has no question', () => {
		expect(getCard('publish_course')!.question).toBeUndefined()
	})

	// Guards: a one-flow card resolving to nothing with no answer. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// cover that path.
	it('resolves a card without a question to its only flow', () => {
		expect(flowForAnswer(getCard('publish_course')!, null)?.id).toBe(
			'publish_course'
		)
	})

	// Guards: a reordered step; stored progress maps by index, so it ticks the
	// wrong one. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to freeze the order.
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

	// Guards: a step's action button losing its short verb. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// labels.
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

	// Guards: two steps sharing a name, so finishing one ticks both. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// catch duplicates.
	it.each(flowRows)('$id has unique step names', ({ id }) => {
		const names = stepsOf(id).map((s) => s.name)
		expect(new Set(names).size).toBe(names.length)
	})

	// Guards: a step locked behind a later step, so it never unlocks.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check dependency order.
	it.each(flowRows)('$id only depends on earlier steps', ({ id }) => {
		const steps = stepsOf(id)
		steps.forEach((step, index) => {
			if (!step.dependsOn) return
			expect(steps.slice(0, index).map((s) => s.name)).toContain(step.dependsOn)
		})
	})

	// Guards: a step shipped done, or keyed to a fact the server never sends.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check the defaults.
	it.each(flowRows)('$id steps start incomplete with known facts', ({ id }) => {
		for (const step of stepsOf(id)) {
			expect(step.completed).toBe(false)
			if (step.fact) expect(FACT_KEYS).toContain(step.fact)
		}
	})

	// Guards: assessment steps losing their facts, quiz dependency or minimise-
	// on-open. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin that flow's wiring.
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

	// Guards: the publish card no longer leading to assessments. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the next card.
	it('offers assessments next once the first course is published', () => {
		expect(getCard('publish_course')!.next[0]).toBe('add_assessments')
	})

	// Guards: a card offering itself or an unknown card under Try next.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check every card.
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

	// Guards: Calendar or the Meet account unlocking before the step it needs.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the chain.
	it('chains the Google Meet set-up steps', () => {
		const steps = stepsOf('live_class_meet')
		const dependsOn = (name: string) =>
			steps.find((s) => s.name === name)?.dependsOn
		expect(dependsOn('connect_google_calendar')).toBe('setup_google_api')
		expect(dependsOn('add_meet_account')).toBe('connect_google_calendar')
	})

	// Guards: a stale stored flow id throwing instead of reading as no flow.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to cover the lookup miss.
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

	// Guards: Publish landing off the course settings, or the panel covering
	// it. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the target.
	it('publish_course asks the settings to focus Publish, minimised', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'publish_course', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			query: { publish: '1' },
			hash: '#settings',
		})
		const step = stepsOf('publish_course').find(
			(s) => s.name === 'publish_course'
		)
		expect(step?.minimizeOnOpen).toBe(true)
	})

	// Guards: Set pricing landing off the paid price, or the panel covering it.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the target.
	it('set_course_pricing asks the settings for a paid price, minimised', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'set_course_pricing', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			query: { pricing: 'paid' },
			hash: '#settings',
		})
		const step = stepsOf('publish_course').find(
			(s) => s.name === 'set_course_pricing'
		)
		expect(step?.minimizeOnOpen).toBe(true)
	})

	// Guards: Add a chapter opening the form on the wrong course. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the target.
	it('opens the new-chapter form on the first course', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'create_first_chapter', nav)
		expect(nav.openForm).toHaveBeenCalledWith({
			name: 'ChapterForm',
			params: { courseName: 'my-course', chapterName: 'new' },
			hash: '#editor',
		})
	})

	// Guards: Add a lesson sending a query the editor cannot read as a new
	// draft. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to round-trip the query.
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

	// Guards: Add a lesson breaking before the first chapter is known.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to cover the fallback.
	it('opens the course editor when the first chapter is not known yet', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'create_first_lesson', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			hash: '#editor',
		})
	})

	// Guards: course steps opening a form with no course to put it in.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to cover the fallback.
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

	// Guards: Create a course opening the wrong form. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the target.
	it('create_first_course opens NewCourse', () => {
		const nav = fakeNav()
		click('publish_course', 'create_first_course', nav)
		expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewCourse' })
	})

	// Guards: an assessment step opening the wrong form. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin each
	// target.
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

	// Guards: the assessment step leaving the course editor. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// target.
	it("adds an assessment in the course editor's open lesson", () => {
		const nav = fakeNav(facts)
		click('add_assessments', 'add_assessment_to_lesson', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			hash: '#editor',
		})
	})

	// Guards: Import users in bulk missing the User data import. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the target.
	it('opens the data import for users to import them in bulk', () => {
		const nav = fakeNav()
		click('onboard_learners', 'import_learners', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'NewDataImport',
			params: { doctype: 'User' },
		})
	})

	// Guards: Fill in batch details opening anything but that batch's settings.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the target.
	it("opens the first batch's settings to fill in its details", () => {
		const nav = fakeNav(facts)
		click('live_class', 'fill_batch_details', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'BatchDetail',
			params: { batchName: 'my-batch' },
			hash: '#settings',
		})
	})

	// Guards: a settings step opening the wrong page or record. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// each target.
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

	// Guards: Create a batch opening the wrong form after a tool is picked.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the target.
	it.each(['live_class_zoom', 'live_class_meet'].map((id) => ({ id })))(
		'$id opens the new batch form',
		({ id }) => {
			const nav = fakeNav()
			click(id, 'create_first_batch', nav)
			expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewBatch' })
		}
	)

	// Guards: Schedule a live class landing on the wrong batch or tab.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the target.
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

	// Guards: Publish the batch opening the wrong batch. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// target.
	it('opens the first batch to publish it', () => {
		const nav = fakeNav(facts)
		click('live_class_zoom', 'publish_batch', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'BatchDetail',
			params: { batchName: 'my-batch' },
		})
	})

	// Guards: batch steps breaking with no batch yet. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to cover the
	// fallback.
	it('falls back to the batch list without a first batch', () => {
		const nav = fakeNav()
		click('live_class_zoom', 'schedule_live_class', nav)
		expect(nav.openRoute).toHaveBeenCalledWith({ name: 'Batches' })
	})
})
