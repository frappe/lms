// OnboardingChecklist: one flow in the framework OnboardingSteps layout.
// The composable is faked so each test sets its own state.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'
import { getFlow } from '@/onboarding/flows'
import { getCard } from '@/onboarding/cards'
import type { FlowStep } from '@/onboarding/types'
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
		props: ['label', 'theme', 'variant', 'size'],
		template:
			'<span class="badge" :data-theme="theme" :data-variant="variant" :data-size="size">{{ label }}</span>',
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
	// Guards: the flow badge showing another flow's percent or the wrong colour.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the badge to this flow's own progress.
	it("shows this flow's percent in amber below 100", () => {
		const badge = mountFlow().find('.badge')
		expect(badge.text()).toBe('33% completed')
		expect(badge.attributes('data-theme')).toBe('amber')
	})

	// Guards: a finished flow keeping the amber in-progress badge. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the done colour.
	it('turns green at 100', () => {
		state.complete = true
		state.progress = { resolved: 6, total: 6, skipped: 1 }
		const badge = mountFlow().find('.badge')
		expect(badge.text()).toBe('100% completed')
		expect(badge.attributes('data-theme')).toBe('green')
	})

	// Guards: Skip all or Reset all missing mid-flow or acting on another flow.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check both reach this flow's id.
	it('offers Reset all and Skip all for this flow in between', async () => {
		const w = mountFlow()
		await buttonIn(w, 'Skip all')!.trigger('click')
		expect(actions.skipRemaining).toHaveBeenCalledWith('live_class_meet')
		await buttonIn(w, 'Reset all')!.trigger('click')
		expect(actions.resetFlow).toHaveBeenCalledWith('live_class_meet')
	})

	// Guards: Reset all shown on a flow with nothing to reset. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to hide it on
	// an untouched flow.
	it('has no Reset all at 0%', () => {
		state.progress = { resolved: 0, total: 6, skipped: 0 }
		const w = mountFlow()
		expect(buttonIn(w, 'Reset all')).toBeUndefined()
		expect(buttonIn(w, 'Skip all')).toBeDefined()
	})
})

describe('answer switch', () => {
	// Guards: the answer switch losing its "Meeting tool: Google Meet" label or
	// selected mark. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to pin its text and options.
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

	// Guards: picking another tool in the switch not saving the answer.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check the click reaches answer().
	it('switches the answer', async () => {
		const w = mountFlow()
		await w
			.find('[data-testid="answer-switch"]')
			.findAll('.option')[0]
			.trigger('click')
		expect(actions.answer).toHaveBeenCalledWith('live_class', 'zoom')
	})

	// Guards: an empty answer switch on a card that asks nothing. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to hide
	// it there.
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
	// Guards: checklist steps missing or out of order. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the rendered
	// step list.
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

	// Guards: done or skipped steps looking open, or blocked steps looking
	// actionable. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the title styling per status.
	it('strikes through done and skipped steps and greys blocked ones', () => {
		const titles = rows(mountFlow()).map((r) =>
			r.find('[data-testid="step-open"]').classes()
		)
		expect(titles[0]).toContain('line-through')
		expect(titles[1]).toContain('line-through')
		expect(titles[2]).not.toContain('line-through')
		expect(titles[3]).toContain('text-ink-gray-4')
	})

	// Guards: a skipped row losing its Skipped badge, or the badge sitting mid-
	// row. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to mark skipped rows once Do it was dropped.
	it('marks a skipped step with a gray Skipped badge at the row end', () => {
		const w = mountFlow()
		const badge = rows(w)[1].find('.badge')
		expect(badge.text()).toBe('Skipped')
		expect(badge.attributes()).toMatchObject({
			'data-theme': 'gray',
			'data-variant': 'subtle',
			'data-size': 'sm',
		})
		expect(badge.element.nextElementSibling).toBeNull()
		expect(rows(w)[0].find('.badge').exists()).toBe(false)
	})

	// Guards: a done step without the green check. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the toggle
	// icon per status.
	it('shows a green check for done and the step icon otherwise', () => {
		const toggles = mountFlow().findAll('[data-testid="step-toggle"]')
		expect(toggles[0].classes()).toContain('text-ink-green-7')
		expect(toggles[1].classes()).not.toContain('text-ink-green-7')
	})

	// Guards: the icon toggle losing aria-label or aria-pressed, or not ticking
	// the step. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to keep the toggle accessible and wired.
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

	// Guards: a blocked step being tickable with no hint about its prerequisite.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the disabled toggle and its tooltip.
	it("disables a blocked step's toggle and explains why", () => {
		const w = mountFlow()
		expect(
			w.findAll('[data-testid="step-toggle"]')[3].attributes('disabled')
		).toBeDefined()
		expect(rows(w)[3].html()).toContain(
			'You need to complete &quot;Set up Google API&quot; first.'
		)
	})

	// Guards: clicking a step title not starting the step. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to check the
	// title calls startStep.
	it('opens a step from its title', async () => {
		const w = mountFlow()
		await rows(w)[2].find('[data-testid="step-open"]').trigger('click')
		expect(actions.startStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
	})

	// Guards: a skipped step's title still opening the step. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to keep
	// skipped titles plain text.
	it('leaves a skipped title inert until it is reset', async () => {
		const title = rows(mountFlow())[1].find('[data-testid="step-open"]')
		expect(title.text()).toBe('Set up Google API')
		expect(title.element.closest('button')).toBeNull()
		expect(title.element.closest('[role="button"]')).toBeNull()
		await title.trigger('click')
		expect(actions.startStep).not.toHaveBeenCalled()
	})

	// Guards: Skip or Reset missing, misrouted, or offered on a blocked step.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check both row controls.
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

	// Guards: an action button (the old Do it) on done or skipped steps.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin each row's verb.
	it('gives each open step its verb, and done or skipped steps none', () => {
		const w = mountFlow()
		expect(
			[0, 1, 2, 3, 4, 5].map((i) => {
				const b = action(w, i)
				return b.exists() ? b.text() : null
			})
		).toEqual([null, null, 'Connect', 'Add', 'Schedule', 'Publish'])
	})

	// Guards: step actions turning solid, or the current step losing its darker
	// text. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the action styling.
	it('keeps every action ghost and marks the current one by colour', () => {
		const w = mountFlow()
		expect(action(w, 2).attributes('data-variant')).toBe('ghost')
		expect(action(w, 2).classes()).toContain('!text-ink-gray-9')
		expect(action(w, 4).attributes('data-variant')).toBe('ghost')
		expect(action(w, 4).classes()).toContain('!text-ink-gray-6')
	})

	// Guards: a skipped row offering anything but Reset. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// skipped row's buttons.
	it('shows no action button on a skipped row, only Reset', () => {
		const row = rows(mountFlow())[1]
		expect(row.find('[data-testid="step-action"]').exists()).toBe(false)
		expect(row.findAll('button').map((b) => b.text())).toEqual(['', 'Reset'])
	})

	// Guards: a blocked step's action running before its prerequisite is done.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the disabled action.
	it("disables a blocked step's action", () => {
		expect(action(mountFlow(), 3).attributes('disabled')).toBeDefined()
	})

	// Guards: the action button not starting its step. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to check it calls
	// startStep.
	it('runs the step from its action', async () => {
		const w = mountFlow()
		await action(w, 2).trigger('click')
		expect(actions.startStep).toHaveBeenCalledWith(
			'live_class_meet',
			'connect_google_calendar'
		)
	})

	// Guards: end padding or margin pushing row actions out of line with Skip
	// all. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to check no end inset on either side.
	it('ends the actions on the same edge as Skip all', () => {
		const w = mountFlow()
		const endInset = /^(?:p|m)(?:e|x|r)?-|^(?:p|m)-/
		const header = w.find('[data-testid="badge-row"]').element
		const rowActions = rows(w)[2].element.lastElementChild!
		for (const el of [header, header.lastElementChild!, rowActions]) {
			expect(Array.from(el.classList).filter((c) => endInset.test(c))).toEqual(
				[]
			)
		}
	})

	// Guards: the action shifting sideways when Skip appears on hover. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// keep Skip invisible, not hidden.
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

	// Guards: the Choose step running as a plain step instead of offering the
	// tools. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to check a pick saves the answer.
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

	// Guards: a skipped Choose step still offering the tool menu. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to drop
	// it with the action.
	it('offers no tools once the step is skipped', () => {
		state.status = { ...state.status, choose_meeting_tool: 'skipped' }
		const w = mount(OnboardingChecklist, {
			props: { card: liveCard, flow: getFlow('live_class')! },
		})
		expect(w.find('[data-testid="step-choice"]').exists()).toBe(false)
		expect(w.find('[data-testid="step-action"]').exists()).toBe(false)
	})
})

describe('when the flow is complete', () => {
	beforeEach(() => {
		state.complete = true
		state.nextStepName = null
	})

	// Guards: Try next missing, truncated, solid, or not opening the next card.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the done view's suggestion.
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

	// Guards: Try it shown for a next card already started. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// Continue label.
	it('says Continue when the next card has progress', () => {
		state.next = getCard('publish_course')
		state.nextProgress = { resolved: 2, total: 6, skipped: 0 }
		const action = mountFlow().find('[data-testid="next-action"]')
		expect(action.text()).toBe('Continue')
	})

	// Guards: an empty Try next block when no card is left. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// all-done message.
	it('says all flows are complete when nothing is left', () => {
		const w = mountFlow()
		expect(w.find('[data-testid="next-up"]').exists()).toBe(false)
		expect(w.text()).toContain('All flows complete')
	})

	// Guards: Try next or All flows complete showing before the flow is done.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep the done view hidden.
	it('shows neither while unfinished', () => {
		state.complete = false
		state.next = getCard('publish_course')
		const w = mountFlow()
		expect(w.text()).not.toContain('All flows complete')
		expect(w.find('[data-testid="next-up"]').exists()).toBe(false)
	})
})
