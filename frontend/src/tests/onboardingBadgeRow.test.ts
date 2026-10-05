/**
 * The flow screen rendered with the real frappe-ui components: the badge row
 * (a stray element between Badge and Button shows up here) and the step rows,
 * compared against a real sidebar nav row.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { SidebarItem } from 'frappe-ui'
import { BookOpen } from 'lucide-vue-next'
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
			complete: () => {},
		})
		.map((step) => ({ ...step, completed: true }))
	return {
		useLearningOnboarding: () => ({
			stepsOf: () => steps,
			stepStatus: () =>
				progress.resolved === progress.total ? 'done' : 'current',
			blocker: () => undefined,
			flowProgress: () => progress,
			isFlowComplete: () => progress.resolved === progress.total,
			answerOf: () => 'meet',
			nextCard: () => null,
			cardProgress: () => null,
			nextStep: () => null,
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

describe('step rows match the sidebar nav rows', () => {
	const classSet = (classes: string[]) => new Set(classes)
	const sizeOf = (classes: string[]) => classes.filter((c) => /^size-/.test(c))

	function sidebarRow() {
		return mount(SidebarItem, {
			props: { label: 'Courses', icon: BookOpen, active: false },
		})
	}

	function stepRow() {
		progress.resolved = 3
		const w = mount(OnboardingChecklist, {
			props: {
				card: getCard('live_class')!,
				flow: getFlow('live_class_meet')!,
			},
			global: { mocks: { __: (text: string) => text } },
		})
		return w.find('[data-testid="flow-step"]')
	}

	// Guards: step rows drifting from frappe-ui's sidebar row. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to compare the
	// class sets.
	it('uses the same row classes as an inactive SidebarItem', () => {
		const nav = sidebarRow().find('[data-slot="sidebar-item"]')
		expect(classSet(stepRow().classes())).toEqual(classSet(nav.classes()))
	})

	it('uses the sidebar’s icon size', () => {
		const navIcon = sidebarRow().find('svg')
		const stepIcon = stepRow().find('[data-testid="step-toggle"] svg')
		expect(sizeOf(stepIcon.classes())).toEqual(sizeOf(navIcon.classes()))
		expect(sizeOf(navIcon.classes())).toEqual(['size-4'])
	})

	// Guards: step action buttons making a row taller than a sidebar row.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin h-7 on the row and its buttons.
	it('keeps the sidebar row height with its buttons inside', () => {
		const row = stepRow()
		expect(row.classes()).toContain('h-7')
		const buttons = row.findAll('[data-testid="step-action"]')
		expect(buttons.length).toBeGreaterThan(0)
		for (const button of buttons) expect(button.classes()).toContain('h-7')
	})
})
