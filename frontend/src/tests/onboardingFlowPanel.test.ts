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
} = vi.hoisted(() => ({
	state: {} as {
		activeFlow: Ref<OnboardingFlow | null>
		remainingCards: Ref<FlowCard[]>
		providerFlows: Ref<OnboardingFlow[]>
		panelView: Ref<'checklist' | 'picker' | 'done' | 'provider'>
	},
	setFlow: vi.fn(),
	chooseCard: vi.fn(),
	cancelProvider: vi.fn(),
	closePanel: vi.fn(),
	runDoneAction: vi.fn(),
}))

vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({
		...state,
		setFlow,
		chooseCard,
		cancelProvider,
		closePanel,
		runDoneAction,
	}),
}))

vi.mock('frappe-ui', () => ({
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
	for (const fn of [setFlow, chooseCard, cancelProvider, closePanel])
		fn.mockReset()
	runDoneAction.mockReset()
	state.activeFlow = ref(null)
	state.remainingCards = ref([...CARDS])
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

	it('has no done title or Maybe later', () => {
		const w = mountPanel()
		expect(w.find('[data-testid="flow-done-title"]').exists()).toBe(false)
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

	it('closes on Maybe later', async () => {
		const w = mountPanel()
		const later = w.findAll('button').find((b) => b.text() === 'Maybe later')
		await later?.trigger('click')
		expect(closePanel).toHaveBeenCalledTimes(1)
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
