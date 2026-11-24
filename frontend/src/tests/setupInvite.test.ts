/**
 * SetupInvite.vue: Learning's invite step. The rows, checks and sending order are the
 * framework's InviteStep, tested there; this covers what Learning adds: its roles, the
 * invitation it sends through, and what happens once people are invited.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const { invite, toast, updateOnboardingStep } = vi.hoisted(() => ({
	invite: vi.fn(),
	toast: { success: vi.fn() },
	updateOnboardingStep: vi.fn(),
}))

vi.mock('frappe-ui', () => ({ toast }))
vi.mock('@framework/ui/components/SetupFlow/index', () => ({
	InviteStep: defineComponent({
		name: 'InviteStep',
		props: ['roles', 'defaultRole', 'firstRole', 'send', 'labels', 'canGoBack'],
		setup: () => () => h('div'),
	}),
}))
vi.mock('@framework/ui/components/InviteUser/index', () => ({
	useInviteUser: () => ({ invite }),
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => ({ updateOnboardingStep }),
}))
vi.mock('@/utils/basePath', () => ({ getLmsBasePath: () => 'lms' }))

async function mountStep(props: Record<string, unknown> = {}) {
	const { default: SetupInvite } = await import('@/components/Setup/SetupInvite.vue')
	const wrapper = mount(SetupInvite, {
		props,
		global: { mocks: { __: (text: string) => text } },
	})
	return { wrapper, step: wrapper.findComponent({ name: 'InviteStep' }) }
}

beforeEach(() => {
	invite.mockReset()
	toast.success.mockReset()
	updateOnboardingStep.mockReset()
})

describe('SetupInvite', () => {
	it('offers Learning’s roles, with students by default and the goal’s role first', async () => {
		const { step } = await mountStep({ firstRole: 'Batch Evaluator' })
		expect(step.props('roles').map((role: { value: string }) => role.value)).toEqual([
			'LMS Student',
			'Course Creator',
			'Batch Evaluator',
			'Moderator',
		])
		expect(step.props('defaultRole')).toBe('LMS Student')
		expect(step.props('firstRole')).toBe('Batch Evaluator')
	})

	it('sends through the framework invitation and reports disabled accounts as failed', async () => {
		invite.mockResolvedValue({
			invited_emails: ['a@example.com'],
			disabled_user_emails: ['b@example.com'],
		})
		const { step } = await mountStep()
		const outcome = await step.props('send')('Course Creator', [
			'a@example.com',
			'b@example.com',
		])
		expect(invite).toHaveBeenCalledWith('a@example.com, b@example.com', ['Course Creator'])
		expect(outcome).toEqual({ invited: 1, failed: ['b@example.com'] })
	})

	it('says how many were invited, ticks the checklist and moves on', async () => {
		const { wrapper, step } = await mountStep()
		step.vm.$emit('done', { invited: 2, roles: ['LMS Student'] })
		expect(toast.success).toHaveBeenCalledTimes(1)
		expect(updateOnboardingStep).toHaveBeenCalledWith('invite_students')
		expect(wrapper.emitted('done')?.[0]).toEqual([{ invited: 2, roles: ['LMS Student'] }])
	})

	it('moves on quietly when nobody new was invited', async () => {
		const { wrapper, step } = await mountStep()
		step.vm.$emit('done', { invited: 0, roles: ['LMS Student'] })
		expect(toast.success).not.toHaveBeenCalled()
		expect(updateOnboardingStep).not.toHaveBeenCalled()
		expect(wrapper.emitted('done')).toHaveLength(1)
	})
})
