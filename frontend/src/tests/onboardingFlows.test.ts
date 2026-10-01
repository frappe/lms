/**
 * The flow registry. Step order is frozen once shipped, because the framework
 * matches stored progress to steps by index.
 */
import { describe, expect, it, vi } from 'vitest'
import {
	CARDS,
	FACT_KEYS,
	FLOWS,
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

describe('flow registry', () => {
	it('ships four flows with their framework keys', () => {
		expect(FLOWS.map((f) => [f.id, f.key])).toEqual([
			['publish_course', 'learning_publish_course'],
			['onboard_learners', 'learning_onboard_learners'],
			['live_class_zoom', 'learning_live_class_zoom'],
			['live_class_meet', 'learning_live_class_meet'],
		])
	})

	it('groups them into three picker cards, live class by provider', () => {
		expect(CARDS.map((c) => [c.id, c.flows.map((f) => f.id)])).toEqual([
			['publish_course', ['publish_course']],
			['onboard_learners', ['onboard_learners']],
			['live_class', ['live_class_zoom', 'live_class_meet']],
		])
		expect(getCard('live_class')!.title).toBe('Run my first live class')
	})

	it('labels each provider flow and nothing else', () => {
		expect(FLOWS.map((f) => f.provider?.label ?? null)).toEqual([
			null,
			null,
			'Zoom',
			'Google Meet',
		])
	})

	it.each([
		{
			id: 'publish_course',
			names: [
				'create_first_course',
				'create_first_chapter',
				'create_first_lesson',
				'add_course_image',
				'preview_course',
				'publish_course',
			],
		},
		{
			id: 'onboard_learners',
			names: [
				'invite_students',
				'create_first_batch',
				'add_batch_course',
				'add_batch_student',
			],
		},
		{
			id: 'live_class_zoom',
			names: [
				'create_first_batch',
				'connect_zoom',
				'schedule_live_class',
				'publish_batch',
			],
		},
		{
			id: 'live_class_meet',
			names: [
				'create_first_batch',
				'setup_google_api',
				'connect_google_calendar',
				'add_meet_account',
				'schedule_live_class',
				'publish_batch',
			],
		},
	])('$id keeps its shipped step order', ({ id, names }) => {
		expect(stepsOf(id).map((s) => s.name)).toEqual(names)
	})

	it.each(FLOWS.map((f) => ({ id: f.id })))(
		'$id has unique step names',
		({ id }) => {
			const names = stepsOf(id).map((s) => s.name)
			expect(new Set(names).size).toBe(names.length)
		}
	)

	it.each(FLOWS.map((f) => ({ id: f.id })))(
		'$id only depends on earlier steps',
		({ id }) => {
			const steps = stepsOf(id)
			steps.forEach((step, index) => {
				if (!step.dependsOn) return
				const earlier = steps.slice(0, index).map((s) => s.name)
				expect(earlier).toContain(step.dependsOn)
			})
		}
	)

	it.each(FLOWS.map((f) => ({ id: f.id })))(
		'$id offers only other known cards next',
		({ id }) => {
			const flow = getFlow(id)!
			expect(flow.next.length).toBeGreaterThan(0)
			for (const next of flow.next) {
				expect(next).not.toBe(flow.card)
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

	it.each(FLOWS.map((f) => ({ id: f.id })))(
		'$id steps start incomplete and name known facts',
		({ id }) => {
			for (const step of stepsOf(id)) {
				expect(step.completed).toBe(false)
				if (step.fact) expect(FACT_KEYS).toContain(step.fact)
			}
		}
	)

	it('reads an unknown flow id as undefined', () => {
		expect(getFlow('paid_course')).toBeUndefined()
		expect(getFlow(null)).toBeUndefined()
	})
})

describe('step targets', () => {
	const facts = { first_course: 'my-course', first_batch: 'my-batch' }

	function click(id: string, name: string, nav: FlowNavigation) {
		const step = stepsOf(id, nav).find((s) => s.name === name)
		step?.onClick?.()
	}

	it('opens the new course form', () => {
		const nav = fakeNav()
		click('publish_course', 'create_first_course', nav)
		expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewCourse' })
	})

	it.each([
		{ name: 'create_first_chapter', hash: '#editor' },
		{ name: 'create_first_lesson', hash: '#editor' },
		{ name: 'add_course_image', hash: '#settings' },
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

	it('completes the preview step on click', () => {
		const nav = fakeNav(facts)
		click('publish_course', 'preview_course', nav)
		expect(nav.complete).toHaveBeenCalledWith('preview_course')
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'my-course' },
			hash: '#overview',
		})
	})

	it('opens members settings to invite students', () => {
		const nav = fakeNav()
		click('onboard_learners', 'invite_students', nav)
		expect(nav.openSettings).toHaveBeenCalledWith('members')
	})

	it.each([
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

	it.each([
		{ id: 'onboard_learners', name: 'create_first_batch' },
		{ id: 'live_class_zoom', name: 'create_first_batch' },
		{ id: 'live_class_meet', name: 'create_first_batch' },
	])('$id opens the new batch form', ({ id, name }) => {
		const nav = fakeNav()
		click(id, name, nav)
		expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewBatch' })
	})

	it.each([
		{
			id: 'onboard_learners',
			name: 'add_batch_course',
			form: 'NewBatchCourse',
			hash: '#settings',
		},
		{
			id: 'onboard_learners',
			name: 'add_batch_student',
			form: 'NewBatchStudent',
			hash: '#dashboard',
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

	it.each([
		{
			id: 'publish_course',
			to: { name: 'CourseDetail', params: { courseName: 'my-course' } },
		},
		{
			id: 'onboard_learners',
			to: { name: 'BatchDetail', params: { batchName: 'my-batch' } },
		},
		{
			id: 'live_class_zoom',
			to: { name: 'BatchDetail', params: { batchName: 'my-batch' } },
		},
		{
			id: 'live_class_meet',
			to: { name: 'BatchDetail', params: { batchName: 'my-batch' } },
		},
	])('$id done action opens its record', ({ id, to }) => {
		const nav = fakeNav(facts)
		getFlow(id)!.doneAction.run(nav)
		expect(nav.openRoute).toHaveBeenCalledWith(to)
	})
})

describe('loading the registry', () => {
	it('does not translate before translation.js installs __', async () => {
		const translate = globalThis.__
		vi.stubGlobal('__', undefined)
		vi.resetModules()
		try {
			await expect(import('@/onboarding/flows')).resolves.toBeDefined()
		} finally {
			vi.stubGlobal('__', translate)
		}
	})
})
