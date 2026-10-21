/**
 * ProfileEvaluator.vue: the evaluator's weekly availability, time off and
 * Google Calendar. Edits stay local until one Save, which writes through the
 * own-record `lms.lms.api` endpoints and never `frappe.client.*` (those fall
 * back to Course Evaluator's role permissions).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'

const { resources, toast } = vi.hoisted(() => ({
	resources: { value: [] as any[] },
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (config: any) => {
			const res: any = reactive({ loading: false, config, data: null })
			res.submit = vi.fn(() => Promise.resolve())
			res.reload = vi.fn(() => Promise.resolve())
			resources.value.push(res)
			return res
		},
		toast,
		Button: {
			props: ['label', 'icon', 'disabled', 'loading', 'variant'],
			emits: ['click'],
			template: `<button :data-icon="icon" :data-variant="variant" :disabled="disabled"
				@click="$emit('click')">{{ label }}</button>`,
		},
		Badge: { props: ['label', 'theme'], template: `<span>{{ label }}</span>` },
		Tooltip: { template: `<div><slot /></div>` },
		ErrorMessage: {
			props: ['message'],
			template: `<p data-testid="error">{{ message }}</p>`,
		},
		Switch: {
			props: ['modelValue'],
			emits: ['update:modelValue'],
			template: `<input type="checkbox" role="switch" :checked="modelValue"
				@change="$emit('update:modelValue', $event.target.checked)" />`,
		},
		FormControl: {
			props: ['modelValue', 'type', 'label', 'id', 'format'],
			emits: ['update:modelValue'],
			template: `<input :id="id" :data-type="type" :data-label="label"
				:value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
		},
	}
})

const { routeQuery, routerReplace } = vi.hoisted(() => ({
	routeQuery: { value: {} as Record<string, string> },
	routerReplace: vi.fn(),
}))
vi.mock('vue-router', () => ({
	useRoute: () => ({ query: routeQuery.value }),
	useRouter: () => ({ replace: routerReplace }),
}))
vi.mock('@/utils/format', () => ({ getDateFormat: () => 'YYYY-MM-DD' }))

String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

const EVALUATOR = 'eva@example.com'

const find = (url: string) => resources.value.find((r) => r.config.url === url)

interface MountOptions {
	viewer?: { name: string; username: string; is_moderator?: boolean }
	googleEnabled?: boolean
	invites?: boolean
	timeOff?: [string | null, string | null]
}

async function mountPanel(options: MountOptions = {}) {
	const {
		viewer = { name: EVALUATOR, username: 'eva' },
		googleEnabled = true,
		invites = true,
		timeOff = [null, null],
	} = options
	resources.value = []
	const { default: ProfileEvaluator } = await import(
		'@/pages/ProfileEvaluator.vue'
	)
	const wrapper = mount(ProfileEvaluator, {
		props: { profile: { data: { name: EVALUATOR, username: 'eva' } } },
		global: {
			provide: { $user: { data: { ...viewer, is_evaluator: true } } },
			mocks: { __: (s: string) => s },
		},
	})
	find('lms.lms.api.get_evaluator_details').data = {
		slots: {
			evaluator: EVALUATOR,
			schedule: [
				{
					name: 2,
					day: 'Monday',
					start_time: '14:00:00',
					end_time: '15:00:00',
				},
				{ name: 1, day: 'Monday', start_time: '9:00:00', end_time: '10:00:00' },
			],
			unavailable_from: timeOff[0],
			unavailable_to: timeOff[1],
		},
		calendar: null,
		google_enabled: googleEnabled,
		evaluation_invites: invites,
		timezone: 'Asia/Kolkata (GMT+5:30)',
	}
	await flushPromises()
	return wrapper
}

const day = (wrapper: VueWrapper, name: string) =>
	wrapper.find(`[data-testid="day-${name}"]`)

const button = (wrapper: VueWrapper, label: string) =>
	wrapper.findAll('button').find((b) => b.text() === label)

const writes = () =>
	resources.value.filter(
		(r) =>
			r.config.url !== 'lms.lms.api.get_evaluator_details' &&
			r.submit.mock.calls.length
	)

beforeEach(() => {
	vi.stubGlobal('__', (s: string) => s)
	toast.success.mockReset()
	toast.error.mockReset()
	routeQuery.value = {}
	routerReplace.mockReset()
	window.read_only_mode = undefined
})
enableAutoUnmount(afterEach)

describe('ProfileEvaluator week', () => {
	it('lists all seven days, each range under its own day', async () => {
		const wrapper = await mountPanel()

		expect(wrapper.findAll('[data-testid^="day-"]')).toHaveLength(7)
		const monday = day(wrapper, 'Monday')
		const starts = monday
			.findAll('[data-testid="range"]')
			.map(
				(r) =>
					(r.find('input[data-type="time"]').element as HTMLInputElement).value
			)
		expect(starts).toEqual(['09:00', '14:00'])
		expect(day(wrapper, 'Tuesday').text()).toContain('Unavailable')
		expect(wrapper.text()).toContain('Times are in Asia/Kolkata (GMT+5:30).')
	})

	it('names every control for screen readers', async () => {
		const wrapper = await mountPanel()
		const monday = day(wrapper, 'Monday')

		expect(monday.find('[role="switch"]').attributes('aria-label')).toBe(
			'Available on Monday'
		)
		const range = monday.find('[data-testid="range"]')
		const named = range
			.findAll('input')
			.map((input) =>
				range.find(`label[for="${input.attributes('id')}"]`).text()
			)
		expect(named).toEqual(['Monday start time', 'Monday end time'])
		const remove = range.find('button[data-icon="lucide-x"]')
		expect(remove.attributes('aria-label')).toBe(
			'Remove 09:00 – 10:00 on Monday'
		)
	})

	it('changes nothing on the server until Save', async () => {
		const wrapper = await mountPanel()
		expect(button(wrapper, 'Discard')).toBeUndefined()
		expect(button(wrapper, 'Save')!.attributes('disabled')).toBeDefined()

		await day(wrapper, 'Tuesday').find('[role="switch"]').setValue(true)
		await day(wrapper, 'Monday')
			.find('button[data-icon="lucide-x"]')
			.trigger('click')

		expect(writes()).toEqual([])
		expect(toast.success).not.toHaveBeenCalled()
		expect(button(wrapper, 'Discard')).toBeTruthy()
		expect(button(wrapper, 'Save')!.attributes('disabled')).toBeUndefined()
	})

	it('turning a day on adds 09:00 to 17:00, and + adds the next hour', async () => {
		const wrapper = await mountPanel()
		await day(wrapper, 'Friday').find('[role="switch"]').setValue(true)
		await day(wrapper, 'Friday')
			.find('button[data-icon="lucide-plus"]')
			.trigger('click')

		const values = day(wrapper, 'Friday')
			.findAll('input[data-type="time"]')
			.map((i) => (i.element as HTMLInputElement).value)
		expect(values).toEqual(['09:00', '17:00', '17:00', '18:00'])
	})

	it('Discard puts back what was saved', async () => {
		const wrapper = await mountPanel()
		await day(wrapper, 'Monday').find('[role="switch"]').setValue(false)
		expect(day(wrapper, 'Monday').text()).toContain('Unavailable')

		await button(wrapper, 'Discard')!.trigger('click')

		expect(
			day(wrapper, 'Monday').findAll('[data-testid="range"]')
		).toHaveLength(2)
		expect(button(wrapper, 'Discard')).toBeUndefined()
	})

	it('saves the whole week and the time off in one call, with one toast', async () => {
		const wrapper = await mountPanel()
		await day(wrapper, 'Wednesday').find('[role="switch"]').setValue(true)
		const [from, to] = wrapper.findAll('input[data-type="date"]')
		await from.setValue('2030-01-01')
		await to.setValue('2030-01-05')

		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		const save = find('lms.lms.api.save_evaluator_availability')
		expect(save.submit).toHaveBeenCalledTimes(1)
		expect(save.submit.mock.calls[0][0]).toEqual({
			schedule: [
				{ day: 'Monday', start_time: '09:00', end_time: '10:00' },
				{ day: 'Monday', start_time: '14:00', end_time: '15:00' },
				{ day: 'Wednesday', start_time: '09:00', end_time: '17:00' },
			],
			unavailable_from: '2030-01-01',
			unavailable_to: '2030-01-05',
		})
		expect(find('lms.lms.api.get_evaluator_details').reload).toHaveBeenCalled()
		expect(toast.success).toHaveBeenCalledTimes(1)
		expect(toast.success).toHaveBeenCalledWith('Availability saved')
	})

	it('shows a server refusal inline, not as a toast', async () => {
		const wrapper = await mountPanel()
		find(
			'lms.lms.api.save_evaluator_availability'
		).submit.mockRejectedValueOnce({
			messages: ['Slot Times are overlapping for some schedules.'],
		})
		await day(wrapper, 'Friday').find('[role="switch"]').setValue(true)

		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		expect(wrapper.find('[data-testid="error"]').text()).toBe(
			'Slot Times are overlapping for some schedules.'
		)
		expect(toast.error).not.toHaveBeenCalled()
		expect(toast.success).not.toHaveBeenCalled()
	})

	it.each([
		{
			name: 'an end before its start',
			start: '16:00',
			end: '15:00',
			message: 'End time must be after the start time.',
		},
		{
			name: 'an overlap',
			start: '09:30',
			end: '15:00',
			message: 'Overlaps with 09:00 – 10:00.',
		},
	])(
		'blocks Save on $name and says so under the range',
		async ({ start, end, message }) => {
			const wrapper = await mountPanel()
			const second = day(wrapper, 'Monday').findAll('[data-testid="range"]')[1]
			const [startInput, endInput] = second.findAll('input')
			await startInput.setValue(start)
			await endInput.setValue(end)

			await button(wrapper, 'Save')!.trigger('click')
			await flushPromises()

			const updated = day(wrapper, 'Monday').findAll('[data-testid="range"]')
			expect(updated[1].find('[data-testid="error"]').text()).toBe(message)
			expect(
				find('lms.lms.api.save_evaluator_availability').submit
			).not.toHaveBeenCalled()
		}
	)

	it('asks for both time-off dates only once Save is tried', async () => {
		const wrapper = await mountPanel()
		await wrapper.findAll('input[data-type="date"]')[0].setValue('2030-01-01')
		expect(
			wrapper.find('[data-testid="time-off"] [data-testid="error"]').exists()
		).toBe(false)

		await button(wrapper, 'Save')!.trigger('click')

		expect(
			wrapper.find('[data-testid="time-off"] [data-testid="error"]').text()
		).toBe('Set both dates, or clear them.')
		expect(
			find('lms.lms.api.save_evaluator_availability').submit
		).not.toHaveBeenCalled()
	})

	it('never writes through raw framework endpoints', async () => {
		await mountPanel()
		const raw = resources.value.filter((r) =>
			String(r.config.url).startsWith('frappe.')
		)
		expect(raw).toEqual([])
	})
})

describe('ProfileEvaluator read-only', () => {
	it("shows a moderator someone else's week as text, with no controls", async () => {
		const wrapper = await mountPanel({
			viewer: { name: 'mod@example.com', username: 'mod', is_moderator: true },
			timeOff: ['2030-01-01', '2030-01-05'],
		})

		expect(day(wrapper, 'Monday').text()).toContain(
			'09:00 – 10:00, 14:00 – 15:00'
		)
		expect(day(wrapper, 'Tuesday').text()).toContain('Unavailable')
		expect(wrapper.findAll('input')).toHaveLength(0)
		expect(button(wrapper, 'Save')).toBeUndefined()
		expect(wrapper.find('[data-testid="time-off"]').text()).toContain(
			'2030-01-01 to 2030-01-05'
		)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(false)
	})

	it('shows the evaluator their own week read-only while the site updates', async () => {
		window.read_only_mode = true
		const wrapper = await mountPanel()

		expect(wrapper.findAll('input')).toHaveLength(0)
		expect(button(wrapper, 'Save')).toBeUndefined()
		expect(wrapper.text()).toContain(
			"You can't change your availability while the site is updating."
		)
	})
})

describe('ProfileEvaluator Google Calendar', () => {
	it.each([
		{
			googleEnabled: false,
			invites: true,
			says: "isn't set up on this site",
			controls: false,
		},
		{
			googleEnabled: true,
			invites: false,
			says: 'Evaluation invites are off',
			controls: true,
		},
		{
			googleEnabled: true,
			invites: true,
			says: 'Google Meet link',
			controls: true,
		},
	])(
		'Google on: $googleEnabled, invites on: $invites',
		async ({ googleEnabled, invites, says, controls }) => {
			const wrapper = await mountPanel({ googleEnabled, invites })
			const section = wrapper.find('[data-testid="calendar"]')

			expect(section.text()).toContain(says)
			expect(section.find('[role="switch"]').exists()).toBe(controls)
		}
	)

	it('saves a calendar change with Save, through the own-calendar endpoint', async () => {
		const wrapper = await mountPanel()
		const update = find('lms.lms.api.update_evaluator_calendar')
		await wrapper
			.find('[role="switch"][aria-label="Add events to Google"]')
			.setValue(false)
		expect(update.submit).not.toHaveBeenCalled()

		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		expect(update.submit).toHaveBeenCalledTimes(1)
		expect(update.submit.mock.calls[0][0]).toEqual({
			fieldname: 'push_to_google_calendar',
			value: 0,
		})
	})

	it('holds Connect until unsaved changes are saved', async () => {
		const wrapper = await mountPanel()
		expect(button(wrapper, 'Connect')!.attributes('disabled')).toBeUndefined()

		await day(wrapper, 'Friday').find('[role="switch"]').setValue(true)

		expect(button(wrapper, 'Connect')!.attributes('disabled')).toBeDefined()
	})

	it('says so when Google did not finish signing in', async () => {
		routeQuery.value = { calendar: 'failed' }
		await mountPanel()

		expect(toast.error).toHaveBeenCalledWith(
			expect.stringContaining('Try again')
		)
		expect(routerReplace).toHaveBeenCalled()
	})
})
