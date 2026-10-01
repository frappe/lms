/**
 * OnboardingFlowPanel end to end: the real composable and registry, with the
 * framework's useOnboarding replaced by an in-memory model. Labels come from
 * the translation getters at render, through setup.ts's `__`, so an empty row
 * here means a getter was read too early or copied away.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'

type FakeStep = { name: string; completed: boolean }

const { framework } = vi.hoisted(() => ({
	framework: { handles: {} as Record<string, ReturnType<typeof makeHandle>> },
}))

function makeHandle() {
	const state = reactive({ steps: [] as FakeStep[] })
	const mark = (name: string, value: boolean) => {
		const step = state.steps.find((s) => s.name === name)
		if (step) step.completed = value
	}
	return {
		get steps() {
			return state.steps
		},
		isOnboardingStepsCompleted: ref(false),
		setUp: (steps: FakeStep[]) => {
			if (!state.steps.length) state.steps = steps
		},
		syncStatus: () => {},
		updateOnboardingStep: vi.fn((name: string, value = true) =>
			mark(name, value)
		),
		skip: vi.fn((name: string) => mark(name, true)),
		reset: vi.fn((name: string) => mark(name, false)),
		skipAll: vi.fn(() => {
			for (const step of state.steps) step.completed = true
		}),
		resetAll: vi.fn(() => {
			for (const step of state.steps) step.completed = false
		}),
	}
}

vi.mock('frappe-ui', () => ({
	call: vi.fn(() => Promise.resolve({})),
	getCachedResource: () => null,
	Badge: { props: ['label'], template: '<span>{{ label }}</span>' },
	Button: {
		props: ['label', 'variant', 'icon', 'href'],
		emits: ['click'],
		template: `<a v-if="href" :href="href">{{ label }}<slot name="prefix" /></a><button v-else type="button" @click="$emit('click', $event)"><slot name="prefix" />{{ label }}<slot /></button>`,
	},
	Dropdown: {
		props: ['options'],
		template: `<div><slot /><span v-for="o in options" :key="o.label" class="option" @click="o.onClick()">{{ o.label }}</span></div>`,
	},
	Progress: { props: ['value'], template: '<div class="progress" />' },
	Tooltip: { props: ['text'], template: '<div :title="text"><slot /></div>' },
}))

vi.mock('frappe-ui/icons', () => ({
	HelpIcon: { template: '<svg />' },
	MaximizeIcon: { template: '<svg />' },
	MinimizeIcon: { template: '<svg />' },
}))

vi.mock('@framework/ui/components/Onboarding/index', async () => {
	const { ref: vueRef } = await import('vue')
	return {
		showHelpModal: vueRef(true),
		minimize: vueRef(false),
		useOnboarding: (key: string) => (framework.handles[key] ??= makeHandle()),
	}
})

const USER = 'admin@example.com'
const nav = { openRoute: vi.fn(), openForm: vi.fn(), openSettings: vi.fn() }

async function setUp() {
	vi.resetModules()
	const { useLearningOnboarding } = await import(
		'@/onboarding/useLearningOnboarding'
	)
	const { default: Panel } = await import(
		'@/components/Onboarding/OnboardingFlowPanel.vue'
	)
	const o = useLearningOnboarding()
	await o.setUpAll(nav)
	const w = mount(Panel)
	await flushPromises()
	return { o, w }
}

function handle(key: string) {
	return framework.handles['learning_' + key]
}

const button = (
	w: { findAll: (s: string) => { text: () => string }[] },
	label: string
) => w.findAll('button').find((b) => b.text() === label)

beforeEach(() => {
	localStorage.clear()
	document.cookie = `user_id=${encodeURIComponent(USER)}`
	framework.handles = {}
})

afterEach(() => {
	document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('header', () => {
	// Guards: the list screen with a wrong title or a back control leading
	// nowhere. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the list header.
	it('titles the list Getting started, with no back control', async () => {
		const { w } = await setUp()
		expect(w.find('h2').text()).toBe('Getting started')
		expect(w.find('[aria-label="All flows"]').exists()).toBe(false)
	})

	// Guards: inner screens losing the way back to the list, or the back icon
	// gaining text. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to check it returns to the list.
	it('puts an icon-only back control before the title on inner screens', async () => {
		const { o, w } = await setUp()
		o.openCardScreen('publish_course')
		await flushPromises()
		const back = w.find('[aria-label="All flows"]')
		expect(back.exists()).toBe(true)
		expect(back.text()).toBe('')
		expect(w.find('h2').text()).toBe('Getting started')
		await back.trigger('click')
		expect(o.screen.value).toBe('list')
	})
})

describe('list screen', () => {
	it('starts fresh on one line, with no count', async () => {
		const { w } = await setUp()
		const heading = w.find('[data-testid="list-heading"]')
		expect(heading.text()).toBe('What do you want to do first?')
	})

	it('shows each card on one line with its description as a tooltip', async () => {
		const { w } = await setUp()
		const rows = w.findAll('[data-testid="flow-row"]')
		expect(rows.map((r) => r.text())).toEqual([
			'Publish my first course0/6',
			'Onboard my existing learners',
			'Run my first live class',
		])
		expect(w.html()).toContain('title="Bring your learners into a batch."')
	})

	it('picks up where you left off with a flows count', async () => {
		const { o, w } = await setUp()
		o.answer('live_class', 'zoom')
		o.showList()
		await flushPromises()
		expect(w.find('[data-testid="list-heading"]').text()).toBe(
			'Pick up where you left off0/3'
		)
		expect(w.findAll('[data-testid="flow-row"]')[2].text()).toContain('0/4')
	})

	it('says you are all set when every card is done', async () => {
		const { o, w } = await setUp()
		o.answer('onboard_learners', 'csv')
		o.answer('live_class', 'meet')
		for (const key of [
			'publish_course',
			'onboard_learners_csv',
			'live_class_meet',
		])
			handle(key).skipAll()
		o.showList()
		await flushPromises()
		expect(w.find('[data-testid="list-heading"]').text()).toBe(
			'You’re all set3/3'
		)
	})

	it('opens a card without a question on its flow', async () => {
		const { o, w } = await setUp()
		await w.findAll('[data-testid="flow-row"]')[0].trigger('click')
		expect(o.screen.value).toBe('flow')
		expect(w.text()).toContain('Create a course')
	})
})

describe('question screen', () => {
	it('labels both options with their step counts', async () => {
		const { w } = await setUp()
		await w.findAll('[data-testid="flow-row"]')[2].trigger('click')
		expect(w.find('[data-testid="question-title"]').text()).toBe(
			'Which meeting tool do you use?'
		)
		const options = w.findAll('[data-testid="question-option"]')
		expect(options.map((o) => o.text())).toEqual([
			'Zoom4 steps',
			'Google Meet6 steps',
		])
		expect(w.html()).toContain('title="Host classes from a Zoom account."')
		expect(w.text()).not.toContain('You can change this later.')
		expect(w.text()).not.toContain('The checklist depends on your choice.')
	})

	it('answering opens that answer’s flow with its step titles', async () => {
		const { o, w } = await setUp()
		await w.findAll('[data-testid="flow-row"]')[2].trigger('click')
		await w.findAll('[data-testid="question-option"]')[1].trigger('click')
		await flushPromises()
		expect(o.screen.value).toBe('flow')
		const titles = w.findAll('[data-testid="flow-step"]').map((r) => r.text())
		expect(titles[1]).toContain('Set up Google API')
		expect(titles[3]).toContain('Add a Google Meet account')
		expect(w.find('[data-testid="answer-chip"]').text()).toContain(
			'Google Meet'
		)
	})

	it('switching the answer on the chip switches the checklist', async () => {
		const { o, w } = await setUp()
		o.answer('onboard_learners', 'csv')
		await flushPromises()
		await w
			.find('[data-testid="answer-chip"]')
			.findAll('.option')
			.find((x) => x.text() === 'Invite by email')!
			.trigger('click')
		await flushPromises()
		expect(o.openFlow.value?.key).toBe('learning_onboard_learners_invite')
		expect(w.text()).toContain('Invite learners by email')
	})
})

describe('footer', () => {
	it('links the help centre', async () => {
		const { w } = await setUp()
		expect(
			w.find('a[href="https://docs.frappe.io/learning"]').text()
		).toContain('Help centre')
	})

	it('shows Reset all on the list only once something has started', async () => {
		const { o, w } = await setUp()
		expect(button(w, 'Reset all')).toBeUndefined()
		o.answer('live_class', 'zoom')
		await flushPromises()
		expect(button(w, 'Reset all')).toBeUndefined()
		o.showList()
		await flushPromises()
		expect(button(w, 'Reset all')).toBeDefined()
	})

	// Guards: Reset all missing a flow, keeping progress, or leaving the list.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check every flow resets.
	it('Reset all starts everything over and stays on the list', async () => {
		const { o, w } = await setUp()
		o.answer('live_class', 'zoom')
		o.completeStep('create_first_course')
		o.showList()
		await flushPromises()
		await w
			.findAll('button')
			.find((b) => b.text() === 'Reset all')!
			.trigger('click')
		await flushPromises()
		for (const key of Object.keys(framework.handles))
			expect(framework.handles[key].resetAll).toHaveBeenCalledTimes(1)
		expect(o.screen.value).toBe('list')
		expect(o.hasAnyProgress.value).toBe(false)
		expect(button(w, 'Reset all')).toBeUndefined()
	})

	it('has no Skip all or Restart onboarding any more', async () => {
		const { w } = await setUp()
		expect(w.text()).not.toContain('Skip all')
		expect(w.text()).not.toContain('Restart onboarding')
	})
})

describe('stale stored ids', () => {
	it('an unknown stored card lands on the list without throwing', async () => {
		localStorage.setItem('learningOnboardingCard' + USER, 'live_class_old')
		localStorage.setItem('learningOnboardingFlow' + USER, 'live_class')
		const { o, w } = await setUp()
		expect(o.screen.value).toBe('list')
		expect(w.findAll('[data-testid="flow-row"]')).toHaveLength(3)
	})

	it('an unknown stored answer asks the question again', async () => {
		localStorage.setItem('learningOnboardingCard' + USER, 'live_class')
		localStorage.setItem(
			'learningOnboardingAnswers' + USER,
			JSON.stringify({ live_class: 'teams' })
		)
		const { o, w } = await setUp()
		expect(o.screen.value).toBe('question')
		expect(w.findAll('[data-testid="question-option"]')).toHaveLength(2)
		expect(w.find('[data-testid="flow-step"]').exists()).toBe(false)
	})

	it('a flow screen whose answer vanished falls back without mounting the checklist', async () => {
		const { o, w } = await setUp()
		o.answer('live_class', 'zoom')
		await flushPromises()
		localStorage.setItem(
			'learningOnboardingAnswers' + USER,
			JSON.stringify({ live_class: 'teams' })
		)
		window.dispatchEvent(
			new StorageEvent('storage', {
				key: 'learningOnboardingAnswers' + USER,
				newValue: JSON.stringify({ live_class: 'teams' }),
				storageArea: localStorage,
			})
		)
		await flushPromises()
		expect(w.find('[data-testid="flow-step"]').exists()).toBe(false)
		expect(w.findAll('[data-testid="question-option"]')).toHaveLength(2)
	})
})
