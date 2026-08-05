/**
 * Tests for EvaluationModal.vue: the evaluation slot picker.
 *
 * Slots are stored in the system timezone and converted server-side into the
 * batch's zone for display. The picker therefore renders `display_*` and
 * submits the system values it was handed: submitting the converted clock would
 * break `validate_slot`, past-slot rejection, completion marking and the
 * calendar event at once.
 *
 * Conversion also moves slots between days, so one rendered day can hold slots
 * from two different stored dates. The date a booking submits has to come from
 * the slot, never from the day it was rendered under.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { resources, calls } = vi.hoisted(() => ({
	resources: { value: [] as any[] },
	calls: { value: [] as any[] },
}))

vi.mock('frappe-ui', () => ({
	createResource: (config: any) => {
		const res: any = { loading: false, config, data: null }
		res.reload = vi.fn()
		resources.value.push(res)
		return res
	},
	call: vi.fn((method: string, args: any) => {
		calls.value.push({ method, args })
		return Promise.resolve({})
	}),
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	Dialog: {
		props: ['open', 'title', 'size', 'actions'],
		template: `<div>
			<slot />
			<button
				v-for="action in actions"
				:key="action.label"
				class="dialog-action"
				@click="action.onClick({ close: () => {} })"
			>{{ action.label }}</button>
		</div>`,
	},
	FormControl: {
		props: ['modelValue', 'type', 'label', 'options'],
		emits: ['update:modelValue'],
		template: `<input :value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)" />`,
	},
}))

vi.mock('@/utils', () => ({
	formatTime: (time: string) => (time ? time.slice(0, 5) : ''),
}))

const COURSE = 'course-1'

/**
 * A Monday 09:00 Asia/Kolkata slot is Sunday 20:30 in America/Los_Angeles, so
 * the group is Sunday and holds slots stored on two different dates.
 */
const SCHEDULE = [
	{
		display_date: '2026-08-02',
		display_day: 'Sunday',
		display_timezone: 'America/Los_Angeles',
		display_timezone_label: 'America/Los_Angeles (GMT-7:00)',
		slots: [
			{
				date: '2026-08-02',
				day: 'Sunday',
				start_time: '23:00:00',
				end_time: '23:30:00',
				display_start_time: '10:30:00',
				display_end_time: '11:00:00',
				display_end_date: '2026-08-02',
			},
			{
				date: '2026-08-03',
				day: 'Monday',
				start_time: '09:00:00',
				end_time: '10:00:00',
				display_start_time: '20:30:00',
				display_end_time: '21:30:00',
				display_end_date: '2026-08-02',
			},
		],
	},
]

function findResource(url: string) {
	return resources.value.find((r) => r.config.url === url)
}

async function mountPicker(schedule = SCHEDULE) {
	resources.value = []
	calls.value = []
	const wrapper = mount(
		await import('@/components/Modals/EvaluationModal.vue').then(
			(m) => m.default
		),
		{
			props: {
				modelValue: true,
				reloadEvals: { reload: vi.fn() },
				courses: [{ course: COURSE, title: 'A Course', evaluator: 'eva' }],
				batch: 'batch-1',
			},
			global: {
				provide: {
					$dayjs: (date: string) => ({ format: () => date }),
					$user: { data: { name: 'student@example.com' } },
				},
				mocks: { __: translate },
			},
		}
	)

	const slots = findResource(
		'lms.lms.doctype.course_evaluator.course_evaluator.get_schedule'
	)
	slots.data = schedule
	await flushPromises()
	return wrapper
}

/** `__` returns a String carrying `.format`, as frappe-ui's does for messages
    with placeholders; a plain string would make `.format` a TypeError. */
function translate(message: string) {
	const translated = new String(message) as any
	translated.format = (...args: any[]) =>
		message.replace(/\{(\d+)\}/g, (_, index) => args[Number(index)])
	return translated
}

describe('evaluation slot picker', () => {
	beforeEach(() => {
		vi.stubGlobal('__', translate)
	})

	it('renders the converted times, not the stored ones', async () => {
		const wrapper = await mountPicker()
		const labels = wrapper.findAll('.grid button').map((b) => b.text())

		expect(labels).toEqual(['10:30 - 11:00', '20:30 - 21:30'])
		expect(wrapper.text()).not.toContain('09:00')
		expect(wrapper.text()).not.toContain('23:00')
	})

	it('labels the range with the display timezone', async () => {
		const wrapper = await mountPicker()
		expect(wrapper.text()).toContain('America/Los_Angeles (GMT-7:00)')
	})

	it('heads each day with the converted day, not the stored one', async () => {
		const wrapper = await mountPicker()
		expect(wrapper.text()).toContain('Sunday')
		expect(wrapper.text()).toContain('2026-08-02')
	})

	it('submits the stored date and time of the slot that was picked', async () => {
		const wrapper = await mountPicker()
		// The second slot renders under Sunday but is stored on Monday.
		await wrapper.findAll('.grid button')[1].trigger('click')
		await wrapper.find('.dialog-action').trigger('click')

		expect(calls.value).toHaveLength(1)
		expect(calls.value[0].method).toBe('frappe.client.insert')
		expect(calls.value[0].args.doc).toMatchObject({
			doctype: 'LMS Certificate Request',
			batch_name: 'batch-1',
			course: COURSE,
			date: '2026-08-03',
			day: 'Monday',
			start_time: '09:00:00',
			end_time: '10:00:00',
		})
	})

	it('marks a slot whose converted end falls on the next day', async () => {
		// 17:00-19:00 Asia/Kolkata is 23:30-01:30 in Pacific/Auckland: one system
		// day, two display days. "23:30 - 01:30" alone would not say which.
		const wrapper = await mountPicker([
			{
				...SCHEDULE[0],
				slots: [
					{
						date: '2026-08-03',
						day: 'Monday',
						start_time: '17:00:00',
						end_time: '19:00:00',
						display_start_time: '23:30:00',
						display_end_time: '01:30:00',
						display_end_date: '2026-08-03',
					},
				],
			},
		])

		const button = wrapper.find('.grid button')
		expect(button.find('sup').exists()).toBe(true)
		expect(button.attributes('aria-label')).toContain('2026-08-03')
	})

	it('does not mark a slot that ends on the day it is rendered under', async () => {
		const wrapper = await mountPicker()
		const buttons = wrapper.findAll('.grid button')

		expect(buttons.every((b) => !b.find('sup').exists())).toBe(true)
		expect(buttons[0].attributes('aria-label')).toBe('10:30 - 11:00')
	})

	it('repeats the zone on days whose offset differs from the header', async () => {
		const wrapper = await mountPicker([
			SCHEDULE[0],
			{
				...SCHEDULE[0],
				display_date: '2026-11-02',
				display_timezone_label: 'America/Los_Angeles (GMT-8:00)',
			},
		])
		expect(wrapper.text()).toContain('America/Los_Angeles (GMT-8:00)')
	})
})
