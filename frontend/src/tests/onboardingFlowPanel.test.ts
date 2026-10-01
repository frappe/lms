/**
 * OnboardingFlowPanel: the picker (no active flow), the provider choice for the
 * live class card, and the done view (active flow finished). The composable is
 * replaced so each test sets the state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import {
	CARDS,
	getFlow,
	type FlowCard,
	type OnboardingFlow,
} from '@/onboarding/flows'
import OnboardingFlowPanel from '@/components/Onboarding/OnboardingFlowPanel.vue'

const {
	state,
	setFlow,
	chooseCard,
	cancelProvider,
	closePanel,
	runDoneAction,
	showAllFlows,
	continueFlow,
	skipAllFlows,
	progress,
} = vi.hoisted(() => ({
	state: {} as {
		activeFlow: Ref<OnboardingFlow | null>
		resumableFlow: Ref<OnboardingFlow | null>
		remainingCards: Ref<FlowCard[]>
		pickerCards: Ref<FlowCard[]>
		providerFlows: Ref<OnboardingFlow[]>
		panelView: Ref<'checklist' | 'picker' | 'done' | 'provider'>
	},
	setFlow: vi.fn(),
	chooseCard: vi.fn(),
	cancelProvider: vi.fn(),
	closePanel: vi.fn(),
	runDoneAction: vi.fn(),
	showAllFlows: vi.fn(),
	continueFlow: vi.fn(),
	skipAllFlows: vi.fn(),
	progress: {
		cards: {} as Record<string, { completed: number; total: number } | null>,
		done: new Set<string>(),
	},
}))

vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({
		...state,
		setFlow,
		chooseCard,
		cancelProvider,
		closePanel,
		runDoneAction,
		showAllFlows,
		continueFlow,
		skipAllFlows,
		cardProgress: (card: FlowCard) => progress.cards[card.id] ?? null,
		flowProgress: () => ({ completed: 2, total: 4 }),
		isCardComplete: (id: string) => progress.done.has(id),
	}),
}))

vi.mock('frappe-ui', () => ({
	Badge: { props: ['label', 'theme'], template: '<span>{{ label }}</span>' },
	Button: {
		props: ['label', 'variant'],
		emits: ['click'],
		template: `<button type="button" @click="$emit('click')">{{ label }}<slot /></button>`,
	},
}))

vi.mock('frappe-ui/icons', () => ({
	HelpIcon: { template: '<svg />' },
	MaximizeIcon: { template: '<svg />' },
	MinimizeIcon: { template: '<svg />' },
}))

vi.mock('@framework/ui/components/Onboarding/index', async () => {
	const { ref: vueRef } = await import('vue')
	return { minimize: vueRef(false) }
})

vi.mock('@/components/Onboarding/OnboardingChecklist.vue', () => ({
	default: {
		props: ['flow'],
		template: '<div data-testid="checklist" :data-key="flow.key" />',
	},
}))

vi.mock('@/components/Icons/LMSLogo.vue', () => ({
	default: { template: '<svg />' },
}))

const [publishCourse, onboardLearners, liveClass] = CARDS
const zoomFlow = getFlow('live_class_zoom')!
const meetFlow = getFlow('live_class_meet')!

function mountPanel() {
	return mount(OnboardingFlowPanel)
}

beforeEach(() => {
	for (const fn of [
		setFlow,
		chooseCard,
		cancelProvider,
		closePanel,
		showAllFlows,
		continueFlow,
		skipAllFlows,
	])
		fn.mockReset()
	progress.cards = {}
	progress.done = new Set()
	runDoneAction.mockReset()
	state.activeFlow = ref(null)
	state.remainingCards = ref([...CARDS])
	state.pickerCards = ref([...CARDS])
	state.resumableFlow = ref(null)
	state.providerFlows = ref([])
	state.panelView = ref('picker')
})

describe('picker', () => {
	it('lists every unfinished card, the live class once', () => {
		const w = mountPanel()
		const rows = w.findAll('[data-testid="picker-flow"]')
		expect(rows.map((r) => r.text())).toEqual([
			expect.stringContaining(publishCourse.title),
			expect.stringContaining(onboardLearners.title),
			expect.stringContaining(liveClass.title),
		])
	})

	it.each([
		{ index: 1, id: 'onboard_learners' },
		{ index: 2, id: 'live_class' },
	])('choosing row $index chooses the $id card', async ({ index, id }) => {
		const w = mountPanel()
		await w.findAll('[data-testid="picker-flow"]')[index].trigger('click')
		expect(chooseCard).toHaveBeenCalledWith(id)
	})

	it('has no done title or Skip all', () => {
		const w = mountPanel()
		expect(w.find('[data-testid="flow-done-title"]').exists()).toBe(false)
		expect(w.text()).not.toContain('Skip all')
		expect(w.text()).not.toContain('Maybe later')
	})

	it('names the panel by its heading', () => {
		const w = mountPanel()
		const section = w.find('section')
		const heading = w.find(`#${section.attributes('aria-labelledby')}`)
		expect(heading.text()).toBe('Getting started')
	})
})

describe('done view', () => {
	beforeEach(() => {
		state.activeFlow.value = zoomFlow
		state.remainingCards.value = [onboardLearners, publishCourse]
		state.panelView.value = 'done'
	})

	it('shows the finished flow’s title and action', async () => {
		const w = mountPanel()
		expect(w.find('[data-testid="flow-done-title"]').text()).toBe(
			'Live class scheduled'
		)
		const cta = w.findAll('button').find((b) => b.text() === 'View batch')
		await cta?.trigger('click')
		expect(runDoneAction).toHaveBeenCalledTimes(1)
	})

	it('offers the remaining flows in order, each with Start', async () => {
		const w = mountPanel()
		const rows = w.findAll('[data-testid="remaining-flow"]')
		expect(rows.map((r) => r.text())).toEqual([
			expect.stringContaining(onboardLearners.title),
			expect.stringContaining(publishCourse.title),
		])
		await rows[1].find('button').trigger('click')
		expect(chooseCard).toHaveBeenCalledWith('publish_course')
	})

	it('gives each Start a name that says which flow', () => {
		const w = mountPanel()
		const start = w.findAll('[data-testid="remaining-flow"] button')[0]
		expect(start.attributes('aria-label')).toBe(
			`Start ${onboardLearners.title}`
		)
	})

	it('offers Skip all instead of Maybe later', async () => {
		const w = mountPanel()
		expect(w.text()).not.toContain('Maybe later')
		const skip = w.findAll('button').find((b) => b.text() === 'Skip all')
		await skip?.trigger('click')
		expect(skipAllFlows).toHaveBeenCalledTimes(1)
		expect(closePanel).not.toHaveBeenCalled()
	})

	it('says so when nothing is left', () => {
		state.remainingCards.value = []
		const w = mountPanel()
		expect(w.findAll('[data-testid="remaining-flow"]')).toHaveLength(0)
		expect(w.text()).toContain('You have finished every getting started flow.')
	})
})

describe('provider choice', () => {
	beforeEach(() => {
		state.providerFlows.value = [zoomFlow, meetFlow]
		state.panelView.value = 'provider'
	})

	it('offers Zoom and Google Meet', () => {
		const w = mountPanel()
		const rows = w.findAll('[data-testid="provider-flow"]')
		expect(rows.map((r) => r.text())).toEqual([
			expect.stringContaining('Zoom'),
			expect.stringContaining('Google Meet'),
		])
		expect(w.findAll('[data-testid="picker-flow"]')).toHaveLength(0)
	})

	it('starts the chosen provider’s flow', async () => {
		const w = mountPanel()
		await w.findAll('[data-testid="provider-flow"]')[1].trigger('click')
		expect(setFlow).toHaveBeenCalledWith('live_class_meet')
	})

	it('goes back without choosing', async () => {
		const w = mountPanel()
		await w.find('[data-testid="provider-back"]').trigger('click')
		expect(cancelProvider).toHaveBeenCalledTimes(1)
		expect(setFlow).not.toHaveBeenCalled()
	})
})

describe('checklist view', () => {
	beforeEach(() => {
		state.activeFlow.value = meetFlow
		state.panelView.value = 'checklist'
	})

	it('renders the checklist for the active flow', () => {
		const w = mountPanel()
		expect(w.find('[data-testid="checklist"]').attributes('data-key')).toBe(
			'learning_live_class_meet'
		)
	})

	it('goes back to all flows without dropping the active one', async () => {
		const w = mountPanel()
		await w.find('[data-testid="all-flows"]').trigger('click')
		expect(showAllFlows).toHaveBeenCalledTimes(1)
		expect(setFlow).not.toHaveBeenCalled()
	})

	it('has no back control outside the checklist', () => {
		state.panelView.value = 'picker'
		const w = mountPanel()
		expect(w.find('[data-testid="all-flows"]').exists()).toBe(false)
	})
})

describe('picker progress', () => {
	it('pins the unfinished active flow as Continue, with its progress', async () => {
		state.activeFlow.value = meetFlow
		state.resumableFlow.value = meetFlow
		state.pickerCards.value = [publishCourse, onboardLearners]
		const w = mountPanel()
		const resume = w.find('[data-testid="continue-flow"]')
		expect(resume.text()).toContain(`Continue: ${meetFlow.title}`)
		expect(resume.text()).toContain('2/4')
		await resume.trigger('click')
		expect(continueFlow).toHaveBeenCalledTimes(1)
		expect(w.findAll('[data-testid="picker-flow"]')).toHaveLength(2)
	})

	it('has no Continue row without an unfinished active flow', () => {
		const w = mountPanel()
		expect(w.find('[data-testid="continue-flow"]').exists()).toBe(false)
	})

	it('shows each card’s progress or a done badge', () => {
		progress.cards = { publish_course: { completed: 3, total: 6 } }
		progress.done = new Set(['onboard_learners'])
		const w = mountPanel()
		const rows = w.findAll('[data-testid="picker-flow"]')
		expect(rows[0].text()).toContain('3/6')
		expect(rows[1].text()).toContain('Done')
		expect(rows[2].text()).not.toMatch(/\d+\/\d+|Done/)
	})
})
