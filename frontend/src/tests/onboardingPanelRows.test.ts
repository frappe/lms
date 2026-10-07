// The panel's rows with frappe-ui's real SidebarItem and Tooltip. The panel
// mounts inside the app <Sidebar>, so a collapsed sidebar reaches its rows, and
// a Tooltip trigger merges its own click handler into the row's.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'
import { sidebarCollapsedKey } from 'frappe-ui'

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

vi.mock('frappe-ui', async (orig) => ({
	...(await orig<typeof import('frappe-ui')>()),
	call: vi.fn(() => Promise.resolve({})),
	getCachedResource: () => null,
}))

vi.mock('@/components/Icons/LMSLogo.vue', () => ({
	default: { template: '<svg class="logo" />' },
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

const errors: unknown[] = []

async function setUp(collapsed: boolean | null) {
	vi.resetModules()
	const { useLearningOnboarding } = await import(
		'@/onboarding/useLearningOnboarding'
	)
	const { default: Panel } = await import(
		'@/components/Onboarding/OnboardingFlowPanel.vue'
	)
	const o = useLearningOnboarding()
	await o.setUpAll(nav)
	const w = mount(Panel, {
		attachTo: document.body,
		global: {
			provide:
				collapsed === null
					? {}
					: { [sidebarCollapsedKey as symbol]: computed(() => collapsed) },
			config: {
				errorHandler: (err: unknown) => {
					errors.push(err)
				},
			},
		},
	})
	await flushPromises()
	return { o, w }
}

type Wrapper = Awaited<ReturnType<typeof setUp>>['w']

// SidebarItem hides a collapsed row's label and suffix with w-0 + opacity-0.
const hiddenParts = (w: Wrapper) =>
	w
		.findAll('[data-slot="sidebar-item"] .w-0')
		.filter((el) => el.classes().includes('opacity-0'))

const control = (w: Wrapper, testid: string) =>
	w.findAll(`[data-testid="${testid}"]`)

beforeEach(() => {
	localStorage.clear()
	document.cookie = `user_id=${encodeURIComponent(USER)}`
	framework.handles = {}
	errors.length = 0
})

afterEach(() => {
	document.body.innerHTML = ''
	document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe.each([
	{ sidebar: 'collapsed', collapsed: true },
	{ sidebar: 'expanded', collapsed: false },
	{ sidebar: 'absent', collapsed: null },
])('panel rows with the sidebar $sidebar', ({ collapsed }) => {
	// Guards: a collapsed app sidebar shrinking panel rows to icons. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// check list labels in every sidebar state.
	it('shows every list row with its title, count and chevron', async () => {
		const { w } = await setUp(collapsed)
		const rows = control(w, 'flow-row')
		expect(rows).toHaveLength(4)
		expect(rows.map((r) => r.find('[data-testid="row-title"]').text())).toEqual(
			[
				'Publish my first course',
				'Add assessments',
				'Run my first live class',
				'Onboard existing users',
			]
		)
		expect(rows.every((r) => r.text().includes('/'))).toBe(true)
		expect(control(w, 'footer-row')[0].text()).toBe('Help center')
		expect(hiddenParts(w)).toEqual([])
	})

	// Guards: a collapsed app sidebar hiding checklist step labels. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// check step labels in all three sidebar states.
	it('shows the step rows of an open checklist', async () => {
		const { w } = await setUp(collapsed)
		await control(w, 'flow-row')[0].trigger('click')
		await flushPromises()
		expect(control(w, 'step-open')[0].text()).toBe('Create a course')
		expect(hiddenParts(w)).toEqual([])
	})

	// Guards: a Tooltip merging its click into the row's onClick, which threw
	// on every click. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to click every list row.
	it('opens a card from each list row without throwing', async () => {
		const { o, w } = await setUp(collapsed)
		for (const [index, title] of [
			'Publish my first course',
			'Add assessments',
			'Run my first live class',
			'Onboard existing users',
		].entries()) {
			o.showList()
			await flushPromises()
			await control(w, 'flow-row')[index].trigger('click')
			await flushPromises()
			expect(o.screen.value).toBe('flow')
			expect(w.find('[data-testid="hero-title"]').text()).toBe(title)
		}
		expect(errors).toEqual([])
	})

	// Guards: Try next and help rows throwing on click or collapsing in a
	// collapsed sidebar. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to click those rows too.
	it('opens Try next and the help centre without throwing', async () => {
		const { o, w } = await setUp(collapsed)
		await control(w, 'flow-row')[3].trigger('click')
		await flushPromises()
		framework.handles['learning_onboard_learners'].skipAll()
		await flushPromises()
		const next = control(w, 'next-up')
		expect(next).toHaveLength(1)
		expect(hiddenParts(w)).toEqual([])
		await next[0].trigger('click')
		await flushPromises()
		expect(o.openCard.value?.id).not.toBe('onboard_learners')

		await control(w, 'footer-row')[0].trigger('click')
		await flushPromises()
		expect(o.screen.value).toBe('help')
		const article = control(w, 'help-article')[0]
		await article.trigger('click')
		await flushPromises()
		expect(article.attributes('aria-expanded')).toBe('true')
		expect(errors).toEqual([])
	})
})

// Guards: Reset all, Skip all and Help center rendering larger than a step's
// action. Introduced in this branch (feat/onboarding-flows, PR pending); test
// added there to keep them at the row action's size.
describe('panel action sizes', () => {
	const sizeClasses = (button: DOMWrapper<Element>) =>
		button.classes().filter((c) => /^(h|px|rounded|text-(base|sm|p))/.test(c))

	it('sizes Reset all, Skip all and Help center like a step action', async () => {
		const { w } = await setUp(null)
		await control(w, 'flow-row')[0].trigger('click')
		await flushPromises()
		framework.handles['learning_publish_course'].updateOnboardingStep(
			'create_first_course'
		)
		await flushPromises()

		const action = control(w, 'step-action')[0]
		for (const testid of ['reset-all', 'skip-all', 'footer-row']) {
			const button = control(w, testid)[0]
			expect(sizeClasses(button), testid).toEqual(sizeClasses(action))
			expect(button.find('span.text-p-sm').exists(), testid).toBe(true)
		}
		expect(control(w, 'footer-row')[0].find('.size-4').exists()).toBe(true)
	})
})
