/**
 * Tests for ProfileEvaluationSchedule.vue: the evaluator's week calendar.
 *
 * Guards the `config` object handed to frappe-ui's Calendar. Three of its four
 * keys were wrong: `redundantCellHeight` is not a CalendarConfig key at all
 * (the real one is `hourHeight`), so it was silently dropped, and
 * `disableModes: ['Day', 'Week']` disabled the very view `defaultMode` opens
 * in — while only ever filtering the switcher in Calendar's DEFAULT header,
 * which this page replaces. A key that does nothing reads like a setting that
 * works, so the config is pinned here rather than left to inspection.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { listResources, seed } = vi.hoisted(() => ({
	listResources: { value: [] as any[] },
	seed: { rows: [{ name: 'CR-0001' }] as any[], error: null as unknown },
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createListResource: (config: any) => {
			const res: any = reactive({
				config,
				data: seed.rows,
				list: { fetched: !seed.error, error: seed.error, loading: false },
			})
			res.reload = vi.fn(() => Promise.reject(seed.error))
			listResources.value.push(res)
			return res
		},
		Button: {
			props: ['label', 'icon', 'variant', 'loading'],
			emits: ['click'],
			template:
				'<button :aria-label="label" @click="$emit(\'click\')"><slot /></button>',
		},
	}
})

vi.mock('frappe-ui/experimental', () => ({
	Calendar: {
		name: 'Calendar',
		props: ['config', 'events'],
		template:
			'<div data-testid="calendar"><slot name="header" v-bind="slotProps" /></div>',
		computed: {
			slotProps() {
				return {
					currentMonthYear: 'September 2026',
					decrement: () => {},
					increment: () => {},
				}
			},
		},
	},
}))

vi.mock('@/components/Modals/Event.vue', () => ({
	default: { props: ['event', 'modelValue'], template: '<div />' },
}))

vi.stubGlobal('__', (text: string) => text)

/**
 * Every key CalendarConfig declares, from
 * node_modules/frappe-ui/experimental/Calendar/types.ts. Anything the page
 * passes outside this set is silently ignored by the component.
 */
const CALENDAR_CONFIG_KEYS = [
	'scrollToHour',
	'disableModes',
	'defaultMode',
	'isEditMode',
	'eventIcons',
	'hourHeight',
	'enableShortcuts',
	'showIcon',
	'timeFormat',
	'weekends',
]

async function mountSchedule(
	rows: any[] = [{ name: 'CR-0001' }],
	viewer = 'evaluator@example.com',
	error: unknown = null
) {
	listResources.value = []
	seed.rows = rows
	seed.error = error
	const { default: ProfileEvaluationSchedule } = await import(
		'@/pages/ProfileEvaluationSchedule.vue'
	)
	const wrapper = mount(ProfileEvaluationSchedule, {
		props: { profile: { data: { name: 'evaluator@example.com' } } },
		global: {
			provide: { $user: { data: { name: viewer } } },
			mocks: { __: (text: string) => text },
		},
	})
	return { wrapper, resource: listResources.value[0] }
}

describe('ProfileEvaluationSchedule calendar config', () => {
	it('passes only keys the Calendar actually reads', async () => {
		const { wrapper } = await mountSchedule()
		const config = wrapper.findComponent({ name: 'Calendar' }).props('config')

		const unknown = Object.keys(config).filter(
			(key) => !CALENDAR_CONFIG_KEYS.includes(key)
		)
		expect(unknown).toEqual([])
	})

	it('opens on the week and gives no way to leave it', async () => {
		const { wrapper } = await mountSchedule()
		const config = wrapper.findComponent({ name: 'Calendar' }).props('config')

		expect(config.defaultMode).toBe('Week')
		// The page replaces #header, so the view switcher never renders; the
		// m/w/d shortcuts are the only other way out, and a view switched into
		// could not be switched back.
		expect(config.enableShortcuts).toBe(false)
	})

	it('does not disable the view it opens in', async () => {
		const { wrapper } = await mountSchedule()
		const config = wrapper.findComponent({ name: 'Calendar' }).props('config')

		expect(config.disableModes ?? []).not.toContain(config.defaultMode)
	})
})

describe('ProfileEvaluationSchedule events', () => {
	it('maps a certificate request onto the calendar event shape', async () => {
		const { resource } = await mountSchedule()
		const [event] = resource.config.transform([
			{
				name: 'CR-0001',
				member_name: 'Ada',
				date: '2026-09-16',
				start_time: '10:00:00',
				end_time: '11:00:00',
				google_meet_link: 'https://meet.example/abc',
			},
		])

		expect(event).toMatchObject({
			id: 'CR-0001',
			title: "Ada's Evaluation",
			participant: 'Ada',
			venue: 'https://meet.example/abc',
			fromDate: '2026-09-16',
			toDate: '2026-09-16',
			fromTime: '10:00:00',
			toTime: '11:00:00',
		})
	})
})

describe('ProfileEvaluationSchedule with no evaluations', () => {
	const empty = (wrapper: any) => wrapper.find('[data-testid="empty-schedule"]')

	it('shows an empty state instead of a blank calendar', async () => {
		const { wrapper } = await mountSchedule([])

		expect(empty(wrapper).text()).toContain('No evaluations yet')
		expect(empty(wrapper).text()).toContain(
			'Evaluations students book with you will show up here.'
		)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(false)
	})

	it('speaks about the evaluator to anyone else', async () => {
		const { wrapper } = await mountSchedule([], 'mod@example.com')

		expect(empty(wrapper).text()).toContain(
			'Evaluations students book with this evaluator will show up here.'
		)
	})

	it('shows the calendar once there is an evaluation', async () => {
		const { wrapper } = await mountSchedule()

		expect(empty(wrapper).exists()).toBe(false)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(true)
	})
})

// Regression from #1010: a failed load left a blank calendar and no way to retry.
// Added on feat/evaluator-availability-redesign (no PR yet) with the error state.
describe('ProfileEvaluationSchedule when the list fails to load', () => {
	const failed = (wrapper: any) =>
		wrapper.find('[data-testid="schedule-error"]')

	it('says so with a Retry instead of a blank calendar', async () => {
		const { wrapper } = await mountSchedule([], undefined, new Error('down'))

		expect(failed(wrapper).text()).toContain('Could not load evaluations')
		expect(wrapper.find('[data-testid="empty-schedule"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(false)
	})

	it('Retry reloads the list', async () => {
		const { wrapper, resource } = await mountSchedule(
			[],
			undefined,
			new Error('down')
		)

		await failed(wrapper).find('button').trigger('click')
		await flushPromises()

		expect(resource.reload).toHaveBeenCalledTimes(1)
	})

	it('keeps showing cached evaluations over the error', async () => {
		const { wrapper } = await mountSchedule(
			[{ name: 'CR-0001' }],
			undefined,
			new Error('down')
		)

		expect(failed(wrapper).exists()).toBe(false)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(true)
	})
})
