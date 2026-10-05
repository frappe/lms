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
	SidebarItem: {
		inheritAttrs: false,
		props: ['label', 'icon', 'onClick'],
		template: `<div class="sidebar-item"><button type="button" v-bind="$attrs" @click="onClick && onClick($event)"><slot name="prefix" /><slot>{{ label }}</slot></button><slot name="suffix" /></div>`,
	},
	call: vi.fn(() => Promise.resolve({})),
	getCachedResource: () => null,
	Badge: {
		props: ['label', 'theme'],
		template: '<span class="badge" :data-theme="theme">{{ label }}</span>',
	},
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
	TextInput: {
		props: ['modelValue', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<input data-testid="help-search" :placeholder="placeholder" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
	Tooltip: { props: ['text'], template: '<div :title="text"><slot /></div>' },
}))

const { openExternalMock } = vi.hoisted(() => ({ openExternalMock: vi.fn() }))
vi.mock('@/utils/openExternal', () => ({ openExternal: openExternalMock }))

vi.mock('@/components/Icons/LMSLogo.vue', () => ({
	default: { template: '<svg class="logo" />' },
}))

vi.mock('frappe-ui/icons', () => ({
	HelpIcon: { template: '<svg class="help-icon" />' },
	StepsIcon: { template: '<svg class="steps-icon" />' },
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
const nav = {
	openRoute: vi.fn(),
	openForm: vi.fn(),
	openSettings: vi.fn(),
	openExternal: vi.fn(),
}

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

const hero = (w: {
	find: (s: string) => { text: () => string; exists: () => boolean }
}) => ({
	title: w.find('[data-testid="hero-title"]').text(),
	count: w.find('[data-testid="hero-count"]').text(),
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
		expect(back.text()).toBe('')
		expect(w.find('h2').text()).toBe('Getting started')
		await back.trigger('click')
		expect(o.screen.value).toBe('list')
	})
})

describe('list screen', () => {
	// Guards: the list hero losing the logo or the flows count. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the hero.
	it('welcomes with the logo and a flows count', async () => {
		const { w } = await setUp()
		expect(w.find('.logo').exists()).toBe(true)
		expect(hero(w)).toEqual({
			title: 'Welcome to Frappe Learning',
			count: '0/3 flows completed',
		})
	})

	// Guards: a fresh panel offering Reset all or a wrong overall percent.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the untouched badge row.
	it('shows the overall percent in amber with Skip all but no Reset all', async () => {
		const { w } = await setUp()
		const badge = w.find('.badge')
		expect(badge.text()).toBe('0% completed')
		expect(badge.attributes('data-theme')).toBe('amber')
		expect(button(w, 'Skip all')).toBeDefined()
		expect(button(w, 'Reset all')).toBeUndefined()
	})

	// Guards: card rows losing their title, count or description tooltip.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the card rows.
	it('lists each card as a step-style row with its count', async () => {
		const { o, w } = await setUp()
		o.answer('live_class', 'zoom')
		o.showList()
		await flushPromises()
		const rows = w.findAll('[data-testid="flow-row"]')
		expect(rows.map((r) => r.text())).toEqual([
			'Publish my first course0/6',
			'Run my first live class1/6',
			'Onboard existing users0/2',
		])
		expect(w.html()).toContain('title="Set up email and bring your users in."')
	})

	// Guards: a finished card row looking unfinished. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the strike-
	// through.
	it('strikes through a finished card', async () => {
		const { o, w } = await setUp()
		handle('publish_course').skipAll()
		o.showList()
		await flushPromises()
		const title = w
			.findAll('[data-testid="flow-row"]')[0]
			.find('[data-testid="row-title"]')
		expect(title.classes()).toContain('line-through')
	})

	it('Skip all finishes everything: 100%, green, 3/3', async () => {
		const { w } = await setUp()
		await w
			.findAll('button')
			.find((b) => b.text() === 'Skip all')!
			.trigger('click')
		await flushPromises()
		expect(hero(w).count).toBe('3/3 flows completed')
		const badge = w.find('.badge')
		expect(badge.text()).toBe('100% completed')
		expect(badge.attributes('data-theme')).toBe('green')
		expect(button(w, 'Skip all')).toBeUndefined()
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

	// Guards: the users card opening on the wrong steps or asking a question.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin its checklist.
	it('opens the users card on its two steps with no question', async () => {
		const { o, w } = await setUp()
		await w.findAll('[data-testid="flow-row"]')[2].trigger('click')
		expect(o.screen.value).toBe('flow')
		expect(hero(w)).toEqual({
			title: 'Onboard existing users',
			count: '0/2 steps completed',
		})
		expect(w.findAll('[data-testid="step-open"]').map((t) => t.text())).toEqual(
			['Set up email', 'Import users in bulk']
		)
		expect(w.find('[data-testid="answer-switch"]').exists()).toBe(false)
	})

	it('opens a card without a question on its checklist', async () => {
		const { o, w } = await setUp()
		await w.findAll('[data-testid="flow-row"]')[0].trigger('click')
		expect(o.screen.value).toBe('flow')
		expect(hero(w)).toEqual({
			title: 'Publish my first course',
			count: '0/6 steps completed',
		})
		expect(w.text()).toContain('Create a course')
	})
})

describe('run my first live class', () => {
	// Guards: the live class card asking for the tool up front, or showing the
	// switch before a pick. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to pin the pre-choice checklist.
	it('opens on the batch steps and the tool choice, with no question first', async () => {
		const { o, w } = await setUp()
		await w.findAll('[data-testid="flow-row"]')[1].trigger('click')
		expect(o.openFlow.value?.id).toBe('live_class')
		expect(hero(w)).toEqual({
			title: 'Run my first live class',
			count: '0/3 steps completed',
		})
		expect(w.findAll('[data-testid="step-open"]').map((t) => t.text())).toEqual(
			['Create a batch', 'Fill in batch details', 'Choose a meeting tool']
		)
		expect(w.find('[data-testid="answer-switch"]').exists()).toBe(false)
	})

	it('picking a tool on the step opens that tool’s checklist with progress kept', async () => {
		const { o, w } = await setUp()
		await w.findAll('[data-testid="flow-row"]')[1].trigger('click')
		o.toggleStep('live_class', 'create_first_batch')
		await flushPromises()
		await w
			.find('[data-testid="step-choice"]')
			.findAll('.option')
			.find((x) => x.text() === 'Google Meet')!
			.trigger('click')
		await flushPromises()
		expect(o.openFlow.value?.id).toBe('live_class_meet')
		expect(hero(w).count).toBe('2/8 steps completed')
		const titles = w.findAll('[data-testid="step-open"]').map((t) => t.text())
		expect(titles).toContain('Set up Google API')
		expect(w.find('[data-testid="answer-switch"]').text()).toContain(
			'Meeting tool: Google Meet'
		)
	})

	// Guards: the answer switch changing its label but not the checklist.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check the flow follows the answer.
	it('switching the tool afterwards switches the checklist', async () => {
		const { o, w } = await setUp()
		o.answer('live_class', 'zoom')
		await flushPromises()
		await w
			.find('[data-testid="answer-switch"]')
			.findAll('.option')
			.find((x) => x.text() === 'Google Meet')!
			.trigger('click')
		await flushPromises()
		expect(o.openFlow.value?.key).toBe('learning_live_class_meet')
		expect(w.text()).toContain('Connect Google Calendar')
	})
})

describe('help centre', () => {
	const footerRow = (w: Awaited<ReturnType<typeof setUp>>['w']) =>
		w.find('[data-testid="panel-footer"]').find('button')

	// Guards: the help footer drifting from the sidebar row look. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the footer row.
	it('is a sidebar row with the help icon', async () => {
		const { w } = await setUp()
		const footer = w.find('[data-testid="panel-footer"]')
		expect(footer.find('.sidebar-item').exists()).toBe(true)
		const row = footerRow(w)
		expect(row.text()).toBe('Help centre')
		expect(row.find('.help-icon').exists()).toBe(true)
	})

	// Guards: Help center leaving the panel, losing article groups, or the footer
	// not flipping back. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to pin the help screen.
	it('opens the in-panel help centre with the articles', async () => {
		const { w } = await setUp()
		await footerRow(w).trigger('click')
		await flushPromises()
		expect(w.find('h2').text()).toBe('Help center')
		expect(w.find('[data-testid="hero-title"]').exists()).toBe(false)
		expect(w.find('[data-testid="help-search"]').exists()).toBe(true)
		expect(w.text()).toContain('All articles')
		const groups = w
			.findAll('[data-testid="help-article"]')
			.map((g) => g.text())
		expect(groups).toEqual([
			'Introduction',
			'Creating a course',
			'Creating a batch',
			'Learning Paths',
			'Assessments',
			'Certification',
			'Monetization',
			'Settings',
		])
		expect(footerRow(w).text()).toBe('Getting started')
		expect(footerRow(w).find('.steps-icon').exists()).toBe(true)
	})

	// Guards: help sub-articles not opening their docs page. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to check the
	// docs URL.
	it('opens an article on the docs site', async () => {
		const { w } = await setUp()
		await footerRow(w).trigger('click')
		await w.findAll('[data-testid="help-article"]')[1].trigger('click')
		const sub = w
			.findAll('[data-testid="help-subarticle"]')
			.filter((x) => x.isVisible())
		expect(sub.map((x) => x.text())).toEqual([
			'Create a course',
			'Add a chapter',
			'Add a lesson',
		])
		await sub[0].trigger('click')
		expect(openExternalMock).toHaveBeenCalledWith(
			'https://docs.frappe.io/learning/create-a-course'
		)
	})

	// Guards: the help search not filtering articles. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the filter.
	it('filters articles by the search', async () => {
		const { w } = await setUp()
		await footerRow(w).trigger('click')
		await w.find('[data-testid="help-search"]').setValue('quiz')
		await flushPromises()
		expect(
			w.findAll('[data-testid="help-article"]').map((g) => g.text())
		).toEqual(['Assessments'])
	})

	// Guards: leaving the help centre dropping the card that was open. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// check the card screen comes back.
	it('Getting started returns to the flows', async () => {
		const { o, w } = await setUp()
		o.openCardScreen('publish_course')
		await flushPromises()
		await footerRow(w).trigger('click')
		await flushPromises()
		await footerRow(w).trigger('click')
		await flushPromises()
		expect(w.find('h2').text()).toBe('Getting started')
		expect(w.find('[data-testid="hero-title"]').text()).toBe(
			'Publish my first course'
		)
		expect(footerRow(w).text()).toBe('Help centre')
	})
})

describe('sidebar rows', () => {
	// Guards: panel rows rebuilt from custom markup that drifts from the sidebar.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep them SidebarItems.
	it('renders list rows and help rows as SidebarItems', async () => {
		const { w } = await setUp()
		const inSidebarItem = (selector: string) =>
			w
				.findAll(selector)
				.every((el) => el.element.closest('.sidebar-item') !== null)
		expect(inSidebarItem('[data-testid="flow-row"]')).toBe(true)
		await w.find('[data-testid="footer-row"]').trigger('click')
		expect(inSidebarItem('[data-testid="help-article"]')).toBe(true)
	})
})

describe('stale stored ids', () => {
	// Guards: a card id saved by an older build crashing the panel. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to check
	// the fallback to the list.
	it('an unknown stored card lands on the list without throwing', async () => {
		localStorage.setItem('learningOnboardingCard' + USER, 'live_class_old')
		localStorage.setItem('learningOnboardingFlow' + USER, 'live_class')
		const { o, w } = await setUp()
		expect(o.screen.value).toBe('list')
		expect(w.findAll('[data-testid="flow-row"]')).toHaveLength(3)
	})

	// Guards: a stale saved answer crashing the live class card. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to check
	// the pre-choice fallback.
	it('an unknown stored answer falls back to the pre-choice flow', async () => {
		localStorage.setItem('learningOnboardingCard' + USER, 'live_class')
		localStorage.setItem(
			'learningOnboardingAnswers' + USER,
			JSON.stringify({ live_class: 'teams' })
		)
		const { o, w } = await setUp()
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('live_class')
		expect(w.findAll('[data-testid="flow-step"]')).toHaveLength(3)
	})
})

describe('staying open', () => {
	// Guards: starting a step closing or minimising the panel. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to keep the
	// panel open while navigating.
	it('clicking a step row or its action navigates behind an open panel', async () => {
		const { w } = await setUp()
		const ui = await import('@framework/ui/components/Onboarding/index')
		await w.findAll('[data-testid="flow-row"]')[0].trigger('click')
		await flushPromises()
		await w.findAll('[data-testid="step-open"]')[0].trigger('click')
		await w.findAll('[data-testid="step-action"]')[0].trigger('click')
		expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewCourse' })
		expect(ui.showHelpModal.value).toBe(true)
		expect(ui.minimize.value).toBe(false)
		expect(w.find('[data-testid="flow-step"]').exists()).toBe(true)
	})
})
