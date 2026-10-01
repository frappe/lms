/**
 * OnboardingChecklist: one flow in the framework OnboardingSteps layout. The
 * badge row, the answer switch, the step rows (tick toggle as the leading
 * icon), and what comes next. The composable is faked so each test sets state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'
import { getCard, getFlow, type FlowStep } from '@/onboarding/flows'
import OnboardingChecklist from '@/components/Onboarding/OnboardingChecklist.vue'

type Status = 'done' | 'skipped' | 'current' | 'upcoming'

const { state, actions } = vi.hoisted(() => ({
	state: {
		steps: [] as FlowStep[],
		status: {} as Record<string, Status>,
		blocked: new Set<string>(),
		progress: { resolved: 0, total: 0, skipped: 0 },
		complete: false,
		answer: null as string | null,
		next: null as unknown,
		nextProgress: null as unknown,
		nextStepName: null as string | null,
		justCompleted: null as { flow: string; step: string } | null,
	},
	actions: {
		toggleStep: vi.fn(),
		skipStep: vi.fn(),
		undoStep: vi.fn(),
		startStep: vi.fn(),
		skipRemaining: vi.fn(),
		resetFlow: vi.fn(),
		answer: vi.fn(),
		openCardScreen: vi.fn(),
		dismissCompleted: vi.fn(),
	},
}))

vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({
		...actions,
		stepsOf: () => state.steps,
		stepStatus: (_id: string, step: FlowStep) => state.status[step.name],
		blocker: (_id: string, step: FlowStep) =>
			state.blocked.has(step.name) ? { title: 'Set up Google API' } : undefined,
		flowProgress: () => state.progress,
		isFlowComplete: () => state.complete,
		answerOf: () => state.answer,
		nextCard: () => state.next,
		cardProgress: () => state.nextProgress,
		nextStep: () =>
			state.steps.find((step) => step.name === state.nextStepName) ?? null,
		justCompleted: {
			get value() {
				return state.justCompleted
			},
		},
	}),
}))

vi.mock('frappe-ui', () => ({
	Badge: {
		props: ['label', 'theme', 'size'],
		template: '<span class="badge" :data-theme="theme">{{ label }}</span>',
	},
	Button: {
		props: ['label', 'variant', 'size', 'disabled'],
		emits: ['click'],
		template: `<button type="button" :data-variant="variant" :disabled="disabled" @click="$emit('click', $event)">{{ label }}<slot /></button>`,
	},
	Dropdown: {
		props: ['options'],
		template: `<div class="dropdown"><slot /><span v-for="o in options" :key="o.label" class="option" :data-selected="o.selected ? 'yes' : 'no'" @click="o.onClick()">{{ o.label }}</span></div>`,
	},
	Tooltip: {
		props: ['text'],
		template: '<div :title="text"><slot /></div>',
	},
}))

const meet = getFlow('live_class_meet')!
const liveCard = getCard('live_class')!

beforeEach(() => {
	for (const fn of Object.values(actions)) fn.mockReset()
	state.steps = meet.steps({
		facts: {},
		openRoute: vi.fn(),
		openForm: vi.fn(),
		openSettings: vi.fn(),
		openExternal: vi.fn(),
		complete: vi.fn(),
	})
	state.status = {
		create_first_batch: 'done',
		setup_google_api: 'skipped',
		connect_google_calendar: 'current',
		add_meet_account: 'upcoming',
		schedule_live_class: 'upcoming',
		publish_batch: 'upcoming',
	}
	state.blocked = new Set(['add_meet_account'])
	state.progress = { resolved: 2, total: 6, skipped: 1 }
	state.complete = false
	state.answer = 'meet'
	state.next = null
	state.nextProgress = null
	state.nextStepName = 'connect_google_calendar'
	state.justCompleted = null
})

function mountFlow() {
	return mount(OnboardingChecklist, { props: { card: liveCard, flow: meet } })
}

const rows = (w: ReturnType<typeof mountFlow>) =>
	w.findAll('[data-testid="flow-step"]')
const buttonIn = (
	el: { findAll: (selector: string) => DOMWrapper<Element>[] },
	label: string
) => el.findAll('button').find((b) => b.text() === label)

describe('badge row', () => {
	it('shows this flow’s percent in amber below 100', () => {
		const badge = mountFlow().find('.badge')
		expect(badge.text()).toBe('33% completed')
		expect(badge.attributes('data-theme')).toBe('amber')
	})

	it('turns green at 100', () => {
		state.complete = true
		state.progress = { resolved: 6, total: 6, skipped: 1 }
		const badge = mountFlow().find('.badge')
		expect(badge.text()).toBe('100% completed')
		expect(badge.attributes('data-theme')).toBe('green')
	})

	it('offers Reset all and Skip all for this flow in between', async () => {
		const w = mountFlow()
		await buttonIn(w, 'Skip all')!.trigger('click')
		expect(actions.skipRemaining).toHaveBeenCalledWith('live_class_meet')
		await buttonIn(w, 'Reset all')!.trigger('click')
		expect(actions.resetFlow).toHaveBeenCalledWith('live_class_meet')
	})

	it('has no Reset all at 0%', () => {
		state.progress = { resolved: 0, total: 6, skipped: 0 }
		const w = mountFlow()
		expect(buttonIn(w, 'Reset all')).toBeUndefined()
		expect(buttonIn(w, 'Skip all')).toBeDefined()
	})

	it('has no Skip all at 100%', () => {
		state.complete = true
		state.progress = { resolved: 6, total: 6, skipped: 0 }
		const w = mountFlow()
		expect(buttonIn(w, 'Skip all')).toBeUndefined()
		expect(buttonIn(w, 'Reset all')).toBeDefined()
	})

	it('has no menu, progress bar or chip any more', () => {
		const w = mountFlow()
		expect(w.find('[data-testid="flow-menu"]').exists()).toBe(false)
		expect(w.find('[data-testid="answer-chip"]').exists()).toBe(false)
		expect(w.text()).not.toContain('Skip remaining')
	})
})

describe('answer switch', () => {
	it('reads "label: answer" and lists the options', () => {
		const w = mountFlow()
		const sw = w.find('[data-testid="answer-switch"]')
		expect(sw.find('button').text()).toBe('Meeting tool: Google Meet')
		expect(
			sw
				.findAll('.option')
				.map((o) => [o.text(), o.attributes('data-selected')])
		).toEqual([
			['Zoom', 'no'],
			['Google Meet', 'yes'],
		])
	})

	it('switches the answer', async () => {
		const w = mountFlow()
		await w
			.find('[data-testid="answer-switch"]')
			.findAll('.option')[0]
			.trigger('click')
		expect(actions.answer).toHaveBeenCalledWith('live_class', 'zoom')
	})

	it('is absent for a card with no question', () => {
		const w = mount(OnboardingChecklist, {
			props: {
				card: getCard('publish_course')!,
				flow: getFlow('publish_course')!,
			},
		})
		expect(w.find('[data-testid="answer-switch"]').exists()).toBe(false)
	})
})

describe('step rows', () => {
	it('lists every step title', () => {
		expect(
			rows(mountFlow()).map((r) => r.find('[data-testid="step-open"]').text())
		).toEqual([
			'Create a batch',
			'Set up Google API',
			'Connect Google Calendar',
			'Add a Google Meet account',
			'Schedule a live class',
			'Publish the batch',
		])
	})

	it('strikes through done and skipped steps and greys blocked ones', () => {
		const titles = rows(mountFlow()).map((r) =>
			r.find('[data-testid="step-open"]').classes()
		)
		expect(titles[0]).toContain('line-through')
		expect(titles[1]).toContain('line-through')
		expect(titles[2]).not.toContain('line-through')
		expect(titles[3]).toContain('text-ink-gray-4')
	})

	it('marks a skipped step with muted Skipped text', () => {
		const w = mountFlow()
		expect(rows(w)[1].text()).toContain('Skipped')
		expect(rows(w)[0].text()).not.toContain('Skipped')
	})

	it('shows a green check for done and the step icon otherwise', () => {
		const toggles = mountFlow().findAll('[data-testid="step-toggle"]')
		expect(toggles[0].classes()).toContain('text-ink-green-7')
		expect(toggles[1].classes()).not.toContain('text-ink-green-7')
	})

	it('makes the leading icon a named, stateful toggle', async () => {
		const toggles = mountFlow().findAll('[data-testid="step-toggle"]')
		expect(toggles[0].attributes('aria-pressed')).toBe('true')
		expect(toggles[0].attributes('aria-label')).toBe(
			'Mark Create a batch as not done'
		)
		expect(toggles[2].attributes('aria-pressed')).toBe('false')
		await toggles[2].trigger('click')
		expect(actions.toggleStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
	})

	it('disables a blocked step’s toggle and explains why', () => {
		const w = mountFlow()
		expect(
			w.findAll('[data-testid="step-toggle"]')[3].attributes('disabled')
		).toBeDefined()
		expect(rows(w)[3].html()).toContain(
			'You need to complete &quot;Set up Google API&quot; first.'
		)
	})

	it('opens a step from its title', async () => {
		const w = mountFlow()
		await rows(w)[2].find('[data-testid="step-open"]').trigger('click')
		expect(actions.startStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
	})

	it('offers Skip on open steps and Reset on resolved ones', async () => {
		const w = mountFlow()
		await buttonIn(rows(w)[2], 'Skip')!.trigger('click')
		expect(actions.skipStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
		await buttonIn(rows(w)[1], 'Reset')!.trigger('click')
		expect(actions.undoStep).toHaveBeenCalledWith(
			'live_class_meet',
			'setup_google_api'
		)
		expect(buttonIn(rows(w)[3], 'Skip')).toBeUndefined()
	})

	it('has no Start button or status rings', () => {
		const w = mountFlow()
		expect(buttonIn(w, 'Start')).toBeUndefined()
		expect(rows(w)[0].attributes('data-status')).toBeUndefined()
	})
})

describe('step action buttons', () => {
	const action = (w: ReturnType<typeof mountFlow>, i: number) =>
		rows(w)[i].find('[data-testid="step-action"]')

	it('gives each open step its verb, and done steps none', () => {
		const w = mountFlow()
		expect(
			[0, 1, 2, 3, 4, 5].map((i) => {
				const b = action(w, i)
				return b.exists() ? b.text() : null
			})
		).toEqual([null, 'Do it', 'Connect', 'Add', 'Schedule', 'Publish'])
	})

	it('keeps every action ghost and marks the current one by colour', () => {
		const w = mountFlow()
		expect(action(w, 2).attributes('data-variant')).toBe('ghost')
		expect(action(w, 2).classes()).toContain('!text-ink-gray-9')
		expect(action(w, 4).attributes('data-variant')).toBe('ghost')
		expect(action(w, 4).classes()).toContain('!text-ink-gray-6')
		expect(action(w, 1).attributes('data-variant')).toBe('ghost')
	})

	it('disables a blocked step’s action', () => {
		expect(action(mountFlow(), 3).attributes('disabled')).toBeDefined()
	})

	it('runs the step from its action, the skipped one included', async () => {
		const w = mountFlow()
		await action(w, 2).trigger('click')
		expect(actions.startStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
		await action(w, 1).trigger('click')
		expect(actions.startStep).toHaveBeenCalledWith(
			'live_class_meet',
			'setup_google_api'
		)
	})

	it('reserves the hover Skip’s space before the action', () => {
		const row = rows(mountFlow())[2]
		const buttons = row.findAll('button').map((b) => b.text())
		expect(buttons.indexOf('Skip')).toBeLessThan(buttons.indexOf('Connect'))
		const skip = row.findAll('button').find((b) => b.text() === 'Skip')!
		expect(skip.classes()).toContain('invisible')
		expect(skip.classes()).not.toContain('hidden')
	})
})

describe('after a step is completed', () => {
	it('confirms it and offers the next step', async () => {
		state.justCompleted = {
			flow: 'live_class_meet',
			step: 'create_first_batch',
		}
		const w = mountFlow()
		const done = w.find('[data-testid="step-done"]')
		expect(done.text()).toContain('Create a batch done')
		const next = done
			.findAll('button')
			.find((b) => b.text().startsWith('Next:'))!
		expect(next.text()).toBe('Next: Connect Google Calendar')
		await next.trigger('click')
		expect(actions.startStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
		expect(actions.dismissCompleted).toHaveBeenCalled()
	})

	it('ignores a step completed in another flow', () => {
		state.justCompleted = { flow: 'publish_course', step: 'add_quiz' }
		expect(mountFlow().find('[data-testid="step-done"]').exists()).toBe(false)
	})

	it('offers the next flow once no step is left', async () => {
		state.complete = true
		state.nextStepName = null
		state.next = getCard('onboard_learners')
		state.justCompleted = { flow: 'live_class_meet', step: 'publish_batch' }
		const done = mountFlow().find('[data-testid="step-done"]')
		const tryIt = done.findAll('button').find((b) => b.text() === 'Try it')!
		await tryIt.trigger('click')
		expect(actions.openCardScreen).toHaveBeenCalledWith('onboard_learners')
		expect(actions.dismissCompleted).toHaveBeenCalled()
	})

	it('offers nothing more when every flow is done', () => {
		state.complete = true
		state.nextStepName = null
		state.justCompleted = { flow: 'live_class_meet', step: 'publish_batch' }
		const done = mountFlow().find('[data-testid="step-done"]')
		expect(done.text()).toContain('Publish the batch done')
		expect(done.findAll('button').map((b) => b.text())).not.toContain('Try it')
	})
})

describe('when the flow is complete', () => {
	beforeEach(() => {
		state.complete = true
		state.nextStepName = null
	})

	it('suggests the next card under Try next, untruncated, with a ghost Try it', async () => {
		state.next = getCard('onboard_learners')
		const w = mountFlow()
		expect(w.text()).toContain('Try next')
		const next = w.find('[data-testid="next-up"]')
		const title = next.find('[data-testid="next-title"]')
		expect(title.text()).toBe('Onboard my existing learners')
		expect(title.classes()).not.toContain('truncate')
		const tryIt = buttonIn(next, 'Try it')!
		expect(tryIt.attributes('data-variant')).toBe('ghost')
		await tryIt.trigger('click')
		expect(actions.openCardScreen).toHaveBeenCalledWith('onboard_learners')
	})

	it('says Continue when the next card has progress', () => {
		state.next = getCard('publish_course')
		state.nextProgress = { resolved: 2, total: 6, skipped: 0 }
		const next = mountFlow().find('[data-testid="next-up"]')
		expect(buttonIn(next, 'Continue')).toBeDefined()
	})

	it('says all flows are complete when nothing is left', () => {
		const w = mountFlow()
		expect(w.find('[data-testid="next-up"]').exists()).toBe(false)
		expect(w.text()).toContain('All flows complete')
	})

	it('shows neither while unfinished', () => {
		state.complete = false
		state.next = getCard('publish_course')
		const w = mountFlow()
		expect(w.text()).not.toContain('All flows complete')
		expect(w.find('[data-testid="next-up"]').exists()).toBe(false)
	})
})
