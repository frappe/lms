import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)

vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		props: ['label'],
		emits: ['click'],
		template: '<button @click="$emit(\'click\')">{{ label }}</button>',
	},
}))

import DashboardTabActions from '@/components/Dashboard/DashboardTabActions.vue'

const mountActions = () =>
	mount(DashboardTabActions, { global: { mocks: { __: globalThis.__ } } })

describe('the dashboard tab actions', () => {
	it('emits export from Export analytics', async () => {
		const actions = mountActions()
		await actions.findAll('button')[0].trigger('click')
		expect(actions.text()).toContain('Export analytics')
		expect(actions.emitted('export')).toHaveLength(1)
	})

	it('emits enroll from Enroll', async () => {
		const actions = mountActions()
		await actions.findAll('button')[1].trigger('click')
		expect(actions.text()).toContain('Enroll')
		expect(actions.emitted('enroll')).toHaveLength(1)
	})
})
