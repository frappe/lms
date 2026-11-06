import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

import BatchCard from '@/pages/Batches/components/BatchCard.vue'

const batch = {
	name: 'B-1',
	title: 'Spring Cohort',
	start_date: '2026-10-13',
	end_date: '2026-11-15',
	start_time: '09:00:00',
	end_time: '11:00:00',
	instructors: [],
}

const progressBar = (progress?: number) =>
	mount(BatchCard, {
		props: { batch: { ...batch, progress } },
		global: {
			mocks: { __: globalThis.__ },
			stubs: {
				CardLink: { template: '<a><slot /></a>' },
				Tooltip: { template: '<div><slot /></div>' },
			},
		},
	}).find('[role="progressbar"]')

describe('BatchCard progress', () => {
	it.each([25, 0])("shows the learner's %d% progress", (progress) => {
		const bar = progressBar(progress)
		expect(bar.attributes('aria-valuenow')).toBe(String(progress))
		expect(bar.attributes('aria-label')).toBe('Batch progress')
	})

	it('shows no bar for a batch without progress', () => {
		expect(progressBar().exists()).toBe(false)
	})
})
