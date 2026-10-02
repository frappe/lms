/**
 * OnboardingBanner: the sidebar's "Getting started" card, an LMS copy of the
 * framework GettingStartedBanner at text-p-sm, driven by one flow's key.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'

const { framework } = vi.hoisted(() => ({
	framework: {
		counts: {} as Record<string, [number, number]>,
		flags: {} as Record<string, { value: boolean }>,
		keys: [] as string[],
	},
}))

vi.mock('@framework/ui/components/Onboarding/index', async () => {
	const { ref: vueRef } = await import('vue')
	return {
		showHelpModal: vueRef(false),
		minimize: vueRef(true),
		useOnboarding: (key: string) => {
			framework.keys.push(key)
			const [done, total] = framework.counts[key] ?? [0, 0]
			framework.flags[key] ??= ref(false)
			return {
				stepsCompleted: computed(() => done),
				totalSteps: computed(() => total),
				isOnboardingStepsCompleted: framework.flags[key],
			}
		},
	}
})

vi.mock('frappe-ui', () => ({
	Button: {
		name: 'Button',
		props: ['label', 'theme', 'variant'],
		emits: ['click'],
		template: `<button type="button" @click="$emit('click')">{{ label }}<slot name="prefix" /><slot /></button>`,
	},
}))

vi.mock('frappe-ui/icons', () => ({
	StepsIcon: { template: '<svg class="steps" />' },
}))

import OnboardingBanner from '@/components/Onboarding/OnboardingBanner.vue'

beforeEach(() => {
	framework.counts = {}
	framework.flags = {}
	framework.keys = []
})

function mountBanner(appName: string, isSidebarCollapsed = false) {
	return mount(OnboardingBanner, { props: { appName, isSidebarCollapsed } })
}

describe('OnboardingBanner', () => {
	it('reads the given flow’s key and shows its count', () => {
		framework.counts.learning_live_class_meet = [2, 6]
		const w = mountBanner('learning_live_class_meet')
		expect(framework.keys).toEqual(['learning_live_class_meet'])
		expect(w.text()).toContain('Getting started')
		expect(w.text()).toContain('2/6 steps')
	})

	// Guards: Continue opening the panel minimised. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to check it restores
	// the panel.
	it('Continue opens the panel at full size', async () => {
		framework.counts.learning_publish_course = [1, 6]
		const ui = await import('@framework/ui/components/Onboarding/index')
		const w = mountBanner('learning_publish_course')
		const button = w.findAll('button').find((b) => b.text() === 'Continue')!
		await button.trigger('click')
		expect(ui.showHelpModal.value).toBe(true)
		expect(ui.minimize.value).toBe(false)
	})

	it('uses ghost buttons, open and collapsed', () => {
		framework.counts.learning_publish_course = [1, 6]
		for (const collapsed of [false, true]) {
			const w = mountBanner('learning_publish_course', collapsed)
			for (const button of w.findAllComponents({ name: 'Button' }))
				expect(button.props('variant')).toBe('ghost')
		}
	})

	// Guards: a fresh banner saying Continue. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the Start now
	// label.
	it('says Start now before any step is done', () => {
		framework.counts.learning_publish_course = [0, 6]
		const w = mountBanner('learning_publish_course')
		expect(w.findAll('button').map((b) => b.text())).toContain('Start now')
	})

	// Guards: banner text off the sidebar's text-p-sm. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the title and
	// count classes.
	it('uses text-p-sm for its text', () => {
		framework.counts.learning_publish_course = [1, 6]
		const w = mountBanner('learning_publish_course')
		expect(w.find('[data-testid="banner-title"]').classes()).toContain(
			'text-p-sm'
		)
		expect(w.find('[data-testid="banner-count"]').classes()).toContain(
			'text-p-sm'
		)
	})

	// Guards: a finished banner with no all-set card, or a Dismiss that does not
	// stick. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to check the dismiss flag.
	it('shows the all set card when every step is done, and dismisses it', async () => {
		framework.counts.learning_publish_course = [6, 6]
		const w = mountBanner('learning_publish_course')
		expect(w.text()).toContain('You are all set')
		await w.find('[aria-label="Dismiss"]').trigger('click')
		expect(framework.flags.learning_publish_course.value).toBe(true)
	})

	// Guards: the collapsed banner showing its label or not opening the panel.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the collapsed button.
	it('collapses to an icon-only button that opens the panel', async () => {
		framework.counts.learning_publish_course = [1, 6]
		const ui = await import('@framework/ui/components/Onboarding/index')
		ui.showHelpModal.value = false
		const w = mountBanner('learning_publish_course', true)
		expect(w.text()).not.toContain('Getting started')
		const button = w.find('[aria-label="Getting started"]')
		await button.trigger('click')
		expect(ui.showHelpModal.value).toBe(true)
	})

	// Guards: a finished collapsed banner leaving a stray button. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the empty render.
	it('renders nothing collapsed once every step is done', () => {
		framework.counts.learning_publish_course = [6, 6]
		const w = mountBanner('learning_publish_course', true)
		expect(w.find('button').exists()).toBe(false)
	})
})
