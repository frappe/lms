// OnboardingChecklist: one flow in the framework OnboardingSteps layout.
// The composable is faked so each test sets its own state.
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
		nextStep: () =>
			state.steps.find((step) => step.name === state.nextStepName) ?? null,
	}),
}))

vi.mock('frappe-ui', () => ({
	SidebarItem: {
		inheritAttrs: false,
		props: ['label', 'icon', 'onClick'],
		template: `<div class="sidebar-item"><button type="button" v-bind="$attrs" @click="onClick && onClick($event)"><slot name="prefix" /><slot>{{ label }}</slot></button><slot name="suffix" /></div>`,
	},
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

function flowSteps(id: string): FlowStep[] {
	return getFlow(id)!.steps({
		facts: {},
		openRoute: vi.fn(),
		openForm: vi.fn(),
		openSettings: vi.fn(),
		complete: vi.fn(),
	})
}

beforeEach(() => {
	for (const fn of Object.values(actions)) fn.mockReset()
	state.status = {
		create_first_batch: 'done',
		setup_google_api: 'skipped',
		connect_google_calendar: 'current',
		add_meet_account: 'upcoming',
		schedule_live_class: 'upcoming',
		publish_batch: 'upcoming',
	}
	// Six of the Meet flow's steps, one per status, so rows index predictably.
	state.steps = flowSteps('live_class_meet').filter(
		(step) => step.name in state.status
	)
	state.blocked = new Set(['add_meet_account'])
	state.progress = { resolved: 2, total: 6, skipped: 1 }
	state.complete = false
	state.answer = 'meet'
	state.next = null
	state.nextProgress = null
	state.nextStepName = 'connect_google_calendar'
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
	it("shows this flow's percent in amber below 100", () => {
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

	// Regression: a finished flow still offered Skip all with nothing left to
	// skip. Introduced and fixed on this branch (feat/onboarding-flows, unpushed).
	it('has no Skip all at 100%', () => {
		state.complete = true
		state.progress = { resolved: 6, total: 6, skipped: 0 }
		const w = mountFlow()
		expect(buttonIn(w, 'Skip all')).toBeUndefined()
		expect(buttonIn(w, 'Reset all')).toBeDefined()
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

	it("disables a blocked step's toggle and explains why", () => {
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

	it("disables a blocked step's action", () => {
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

	it("reserves the hover Skip's space before the action", () => {
		const row = rows(mountFlow())[2]
		const buttons = row.findAll('button').map((b) => b.text())
		expect(buttons.indexOf('Skip')).toBeLessThan(buttons.indexOf('Connect'))
		const skip = row.findAll('button').find((b) => b.text() === 'Skip')!
		expect(skip.classes()).toContain('invisible')
		expect(skip.classes()).not.toContain('hidden')
	})
})

describe('choosing a meeting tool', () => {
	beforeEach(() => {
		state.steps = flowSteps('live_class')
		state.status = {
			create_first_batch: 'done',
			fill_batch_details: 'done',
			choose_meeting_tool: 'current',
		}
		state.answer = null
		state.nextStepName = 'choose_meeting_tool'
	})

	it("offers the tools on the step's own action", async () => {
		const w = mount(OnboardingChecklist, {
			props: { card: liveCard, flow: getFlow('live_class')! },
		})
		const choice = w.find('[data-testid="step-choice"]')
		expect(choice.find('[data-testid="step-action"]').text()).toBe('Choose')
		const options = choice.findAll('.option')
		expect(options.map((o) => o.text())).toEqual(['Zoom', 'Google Meet'])
		await options[1].trigger('click')
		expect(actions.answer).toHaveBeenCalledWith('live_class', 'meet')
		expect(actions.startStep).not.toHaveBeenCalled()
	})

	it('hides the answer switch until a tool is picked', () => {
		const w = mount(OnboardingChecklist, {
			props: { card: liveCard, flow: getFlow('live_class')! },
		})
		expect(w.find('[data-testid="answer-switch"]').exists()).toBe(false)
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
		expect(title.text()).toBe('Onboard existing users')
		expect(title.classes()).not.toContain('truncate')
		const tryIt = w.find('[data-testid="next-action"]')
		expect(tryIt.text()).toBe('Try it')
		expect(tryIt.attributes('data-variant')).toBe('ghost')
		await tryIt.trigger('click')
		expect(actions.openCardScreen).toHaveBeenCalledWith('onboard_learners')
	})

	it('says Continue when the next card has progress', () => {
		state.next = getCard('publish_course')
		state.nextProgress = { resolved: 2, total: 6, skipped: 0 }
		const action = mountFlow().find('[data-testid="next-action"]')
		expect(action.text()).toBe('Continue')
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
