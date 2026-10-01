/**
 * The flow screen's badge row rendered with the real frappe-ui Badge and
 * Button, so a stray element between them shows up here.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { getCard, getFlow } from '@/onboarding/flows'
import OnboardingChecklist from '@/components/Onboarding/OnboardingChecklist.vue'

const { progress } = vi.hoisted(() => ({
	progress: { resolved: 6, total: 6, skipped: 0 },
}))

vi.mock('@/onboarding/useLearningOnboarding', async () => {
	const { getFlow: flow } = await import('@/onboarding/flows')
	const steps = flow('live_class_meet')!
		.steps({
			facts: {},
			openRoute: () => {},
			openForm: () => {},
			openSettings: () => {},
			openExternal: () => {},
			complete: () => {},
		})
		.map((step) => ({ ...step, completed: true }))
	return {
		useLearningOnboarding: () => ({
			stepsOf: () => steps,
			stepStatus: () => 'done',
			blocker: () => undefined,
			flowProgress: () => progress,
			isFlowComplete: () => progress.resolved === progress.total,
			answerOf: () => 'meet',
			nextCard: () => null,
			cardProgress: () => null,
			nextStep: () => null,
			justCompleted: { value: null },
			dismissCompleted: () => {},
		}),
	}
})

function badgeRow() {
	const w = mount(OnboardingChecklist, {
		props: { card: getCard('live_class')!, flow: getFlow('live_class_meet')! },
		global: { mocks: { __: (text: string) => text } },
	})
	return w.find('[data-testid="badge-row"]')
}

describe('badge row', () => {
	// Guards: a finished flow offering Skip all, or a stray separator in the row.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin its exact content with real frappe-ui.
	it('holds only the badge and Reset all at 100%', () => {
		progress.resolved = 6
		const row = badgeRow()
		expect(row.text()).toBe('100% completedReset all')
		expect(row.findAll('button')).toHaveLength(1)
		expect(row.text()).not.toContain('|')
	})

	it('holds the badge, Reset all and Skip all in between', () => {
		progress.resolved = 3
		const row = badgeRow()
		expect(row.findAll('button').map((b) => b.text())).toEqual([
			'Reset all',
			'Skip all',
		])
	})
})
