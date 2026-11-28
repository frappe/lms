import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { BATCH_FORM } from '@/pages/Batches/composables/useBatchForm'

vi.stubGlobal('__', (text: string) => text)

const { rows } = vi.hoisted(() => ({
	rows: { data: [] as unknown[], list: { loading: false } },
}))

vi.mock('frappe-ui', () => ({
	usePortalTarget: () => undefined,
	createListResource: () => rows,
	Button: {
		props: ['label'],
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot />{{ label }}</button>`,
	},
}))

vi.mock('@/utils', () => ({}))

import BatchSchedule from '@/pages/Batches/components/overview/BatchSchedule.vue'

const Blank = { render: () => null }

async function mountSchedule(doc: Record<string, unknown> | null) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/batches/:batchName', name: 'BatchDetail', component: Blank },
			{
				path: '/batches/:batchName/live-class/new',
				name: 'NewLiveClass',
				component: Blank,
			},
		],
	})
	await router.push('/batches/B1#overview')
	const wrapper = mount(BatchSchedule, {
		props: { batchName: 'B1', editable: true },
		global: {
			plugins: [router],
			mocks: { __: (text: string) => text },
			provide: { [BATCH_FORM as symbol]: { doc: computed(() => doc) } },
		},
	})
	return { wrapper, router }
}

describe('BatchSchedule empty state', () => {
	it('opens the schedule-class form from the empty tile', async () => {
		const { wrapper, router } = await mountSchedule({
			conferencing_provider: 'Zoom',
			zoom_account: 'Z1',
		})
		expect(wrapper.text()).toContain('No classes scheduled')
		await wrapper.get('[data-testid="schedule-add-class"]').trigger('click')
		await router.isReady()
		await new Promise((resolve) => setTimeout(resolve))
		expect(router.currentRoute.value.name).toBe('NewLiveClass')
		expect(router.currentRoute.value.hash).toBe('#overview')
	})

	it('tells the editor learners see it only once there are classes', async () => {
		const { wrapper } = await mountSchedule({ conferencing_provider: 'Zoom' })
		const hint = wrapper.get('button[aria-label="About the schedule"]')
		const description = hint.attributes('aria-describedby')!
		expect(wrapper.get(`[id="${description}"]`).text()).toBe(
			'Shown to enrolled learners once you add classes'
		)
	})

	it('points to Settings while no conferencing account is set', async () => {
		const { wrapper } = await mountSchedule({
			conferencing_provider: 'Google Meet',
		})
		expect(wrapper.text()).toContain('Set up live classes')
		expect(wrapper.text()).toContain('Open Settings')
		expect(wrapper.find('[data-testid="schedule-add-class"]').exists()).toBe(
			false
		)
	})
})
