/**
 * OnboardingChecklist: the flow screen. Steps, status circles, hover actions,
 * the ... menu, the answer chip, and what comes next. The composable is faked
 * so each test sets the state it needs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
	}),
}))

vi.mock('frappe-ui', () => ({
	Badge: { props: ['label', 'theme'], template: '<span>{{ label }}</span>' },
	Button: {
		props: ['label', 'variant', 'icon'],
		emits: ['click'],
		template: `<button type="button" @click="$emit('click', $event)">{{ label }}<slot /></button>`,
	},
	Dropdown: {
		props: ['options'],
		template: `<div class="dropdown"><slot /><span v-for="o in options" :key="o.label" class="option" :data-selected="o.selected ? 'yes' : 'no'" @click="o.onClick()">{{ o.label }}</span></div>`,
	},
	Progress: {
		props: ['value'],
		template: '<div class="progress" :data-value="value" />',
	},
	Tooltip: { props: ['text'], template: '<div :title="text"><slot /></div>' },
}))

const meet = getFlow('live_class_meet')!
const liveCard = getCard('live_class')!

function steps(): FlowStep[] {
	return meet.steps({
		facts: {},
		openRoute: vi.fn(),
		openForm: vi.fn(),
		openSettings: vi.fn(),
		complete: vi.fn(),
	})
}

beforeEach(() => {
	for (const fn of Object.values(actions)) fn.mockReset()
	state.steps = steps()
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
})

function mountFlow() {
	return mount(OnboardingChecklist, { props: { card: liveCard, flow: meet } })
}

const rows = (w: ReturnType<typeof mountFlow>) =>
	w.findAll('[data-testid="flow-step"]')

describe('flow header', () => {
	it('puts title and meta on one line', () => {
		const w = mountFlow()
		const header = w.find('[data-testid="flow-header"]')
		expect(header.text()).toContain('Run my first live class')
		expect(header.text()).toContain('2/6 · 1 skipped')
		expect(header.text()).not.toContain('Complete')
	})

	it('says Complete once the flow is done', () => {
		state.complete = true
		state.progress = { resolved: 6, total: 6, skipped: 1 }
		const w = mountFlow()
		expect(w.find('[data-testid="flow-header"]').text()).toContain(
			'6/6 · 1 skipped · Complete'
		)
	})

	it('shows progress as a percentage', () => {
		const w = mountFlow()
		expect(w.find('.progress').attributes('data-value')).toBe('33')
	})

	it('offers Skip remaining and Reset this flow', async () => {
		const w = mountFlow()
		const menu = w.find('[data-testid="flow-menu"]')
		const options = menu.findAll('.option')
		expect(options.map((o) => o.text())).toEqual([
			'Skip remaining',
			'Reset this flow',
		])
		await options[0].trigger('click')
		expect(actions.skipRemaining).toHaveBeenCalledWith('live_class_meet')
		await options[1].trigger('click')
		expect(actions.resetFlow).toHaveBeenCalledWith('live_class_meet')
	})

	it('drops Skip remaining once complete', () => {
		state.complete = true
		const w = mountFlow()
		const labels = w
			.find('[data-testid="flow-menu"]')
			.findAll('.option')
			.map((o) => o.text())
		expect(labels).toEqual(['Reset this flow'])
	})
})

describe('answer chip', () => {
	it('shows the question label and current answer', () => {
		const w = mountFlow()
		const chip = w.find('[data-testid="answer-chip"]')
		expect(chip.text()).toContain('Meeting tool')
		const options = chip.findAll('.option')
		expect(
			options.map((o) => [o.text(), o.attributes('data-selected')])
		).toEqual([
			['Zoom', 'no'],
			['Google Meet', 'yes'],
		])
	})

	it('switches the answer', async () => {
		const w = mountFlow()
		await w
			.find('[data-testid="answer-chip"]')
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
		expect(w.find('[data-testid="answer-chip"]').exists()).toBe(false)
	})
})

describe('step rows', () => {
	it('renders each status', () => {
		const w = mountFlow()
		expect(rows(w).map((r) => r.attributes('data-status'))).toEqual([
			'done',
			'skipped',
			'current',
			'upcoming',
			'upcoming',
			'upcoming',
		])
		expect(rows(w)[1].text()).toContain('Skipped')
		expect(rows(w)[0].text()).not.toContain('Skipped')
	})

	it('makes each status circle a named, stateful toggle', async () => {
		const w = mountFlow()
		const toggles = w.findAll('[data-testid="step-toggle"]')
		expect(toggles[0].attributes('aria-pressed')).toBe('true')
		expect(toggles[0].attributes('aria-label')).toBe(
			'Mark Create a batch as not done'
		)
		expect(toggles[2].attributes('aria-pressed')).toBe('false')
		expect(toggles[2].attributes('aria-label')).toBe(
			'Mark Connect Google Calendar as done'
		)
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

	it('offers Skip and Start on the current step', async () => {
		const w = mountFlow()
		const current = rows(w)[2]
		const button = (label: string) =>
			current.findAll('button').find((b) => b.text() === label)!
		await button('Start').trigger('click')
		expect(actions.startStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
		await button('Skip').trigger('click')
		expect(actions.skipStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
	})

	it('offers Undo on resolved steps only', async () => {
		const w = mountFlow()
		const has = (i: number) =>
			rows(w)
				[i].findAll('button')
				.some((b) => b.text() === 'Undo')
		expect([0, 1, 2, 3].map(has)).toEqual([true, true, false, false])
		await rows(w)[1]
			.findAll('button')
			.find((b) => b.text() === 'Undo')!
			.trigger('click')
		expect(actions.undoStep).toHaveBeenCalledWith(
			'live_class_meet',
			'setup_google_api'
		)
	})

	it('has no Start on upcoming steps', () => {
		const w = mountFlow()
		expect(
			rows(w)[4]
				.findAll('button')
				.map((b) => b.text())
		).not.toContain('Start')
	})
})

describe('when the flow is complete', () => {
	beforeEach(() => {
		state.complete = true
	})

	it('suggests the next unfinished card', async () => {
		state.next = getCard('onboard_learners')
		const w = mountFlow()
		const next = w.find('[data-testid="next-up"]')
		expect(w.text()).toContain('Next up')
		expect(next.text()).toContain('Onboard my existing learners')
		const start = next.findAll('button').find((b) => b.text() === 'Start')!
		await start.trigger('click')
		expect(actions.openCardScreen).toHaveBeenCalledWith('onboard_learners')
	})

	it('says Continue when the next card has progress', () => {
		state.next = getCard('publish_course')
		state.nextProgress = { resolved: 2, total: 6, skipped: 0 }
		const w = mountFlow()
		const labels = w
			.find('[data-testid="next-up"]')
			.findAll('button')
			.map((b) => b.text())
		expect(labels).toContain('Continue')
	})

	it('says everything is complete when nothing is left', () => {
		const w = mountFlow()
		expect(w.find('[data-testid="next-up"]').exists()).toBe(false)
		expect(w.text()).toContain('All flows complete')
		expect(w.text()).toContain('You can revisit any flow from the list.')
	})

	it('shows nothing of the sort while unfinished', () => {
		state.complete = false
		const w = mountFlow()
		expect(w.text()).not.toContain('All flows complete')
		expect(w.find('[data-testid="next-up"]').exists()).toBe(false)
	})
})
