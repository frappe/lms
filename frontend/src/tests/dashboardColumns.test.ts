import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)
vi.mock('frappe-ui/charts', () => ({ NumberCard: { template: '<div />' } }))

import DashboardKpiCards from '@/components/Dashboard/DashboardKpiCards.vue'
import { useDashboardColumns } from '@/composables/dashboard/useDashboardColumns'

const dockFlow = async (): Promise<void> => {
	document.documentElement.style.setProperty('--flow-dock-width', '420px')
	await flushPromises()
}

afterEach(async () => {
	document.documentElement.style.removeProperty('--flow-dock-width')
	await flushPromises()
})

describe('the dashboard columns', () => {
	it('puts the side panels beside the list on a wide container with Flow closed', () => {
		const { gridClass, kpiClass } = useDashboardColumns()
		expect(gridClass.value).toContain('@5xl:grid-cols-[minmax(0,1fr)_22rem]')
		expect(kpiClass.value).toContain('@5xl:grid-cols-2')
	})

	it('lets only the side by side grid fill the page height', async () => {
		const { gridClass } = useDashboardColumns()
		expect(gridClass.value).toContain('lg:@5xl:flex-1')
		await dockFlow()
		expect(gridClass.value).not.toContain('flex-1')
	})

	it('stacks the side panels below the list at any width while Flow is docked', async () => {
		const { gridClass, kpiClass } = useDashboardColumns()
		await dockFlow()
		expect(gridClass.value).toBe('')
		expect(kpiClass.value).toBe('')
	})

	it('keeps four KPI cards across the full width while Flow is docked', async () => {
		const cards = mount(DashboardKpiCards, {
			props: { kpis: [], loading: false },
		})
		const kpis = () => cards.get('[data-slot="dashboard-kpis"]').classes()
		expect(kpis()).toContain('@5xl:grid-cols-2')
		await dockFlow()
		expect(kpis()).toContain('@2xl:grid-cols-4')
		expect(kpis()).not.toContain('@5xl:grid-cols-2')
		cards.unmount()
	})
})
