/**
 * ProfileEvaluator.vue: edits stay local until one Save through the own-record
 * `lms.lms.api` endpoint, never `frappe.client.*` (Course Evaluator role perms).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'

const { resources, toast } = vi.hoisted(() => ({
	resources: { value: [] as any[] },
	toast: { success: vi.fn(), error: vi.fn() },
}))

const { lmsSettingsDoc } = vi.hoisted(() => ({
	lmsSettingsDoc: { config: null, doc: undefined } as {
		config: unknown
		doc?: Record<string, unknown>
	},
}))

vi.mock('frappe-ui', async () => {
	const { reactive, ref } = await import('vue')
	return {
		createResource: (config: any) => {
			const res: any = reactive({
				loading: false,
				config,
				data: null,
				error: null,
			})
			res.submit = vi.fn(() => Promise.resolve())
			res.reload = vi.fn(() => Promise.resolve())
			res.setData = vi.fn((data: unknown) => {
				res.data = data
			})
			resources.value.push(res)
			return res
		},
		createDocumentResource: (config: any) => {
			lmsSettingsDoc.config = config
			return lmsSettingsDoc
		},
		toast,
		Button: {
			props: ['label', 'icon', 'disabled', 'loading', 'variant', 'href'],
			emits: ['click'],
			template: `<button :data-icon="icon" :data-variant="variant" :data-href="href" :disabled="disabled"
				@click="$emit('click')"><slot name="prefix" /><slot name="icon" />{{ label }}<slot /></button>`,
		},
		TextInput: {
			props: ['modelValue', 'variant', 'disabled'],
			emits: ['update:modelValue'],
			setup(_: unknown, { expose }: any) {
				const el = ref<HTMLInputElement | null>(null)
				expose({
					focus: () => el.value?.focus(),
					get inputElement() {
						return el.value
					},
				})
				return { el }
			},
			template: `<input ref="el" data-testid="text-input" :data-variant="variant"
				:disabled="disabled" :value="modelValue"
				@input="$emit('update:modelValue', $event.target.value)" />`,
		},
		Badge: { props: ['label', 'theme'], template: `<span>{{ label }}</span>` },
		Alert: {
			props: ['title', 'description', 'theme'],
			template: `<div role="alert" :data-theme="theme">
				<strong>{{ title }}</strong><p>{{ description }}</p></div>`,
		},
		Skeleton: { template: `<div data-testid="skeleton" />` },
		Tooltip: {
			props: ['text'],
			template: `<div :data-tooltip="text"><slot /></div>`,
		},
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
		DateRangePicker: {
			props: [
				'id',
				'modelValue',
				'placeholder',
				'format',
				'variant',
				'disabled',
			],
			emits: ['update:modelValue'],
			template: `<div data-testid="range-picker" :data-variant="variant"
				:data-placeholder="placeholder" :data-format="format">
				<input :id="id" data-type="range" :disabled="disabled"
					:value="modelValue.join(',')"
					@input="$emit('update:modelValue',
						$event.target.value ? $event.target.value.split(',') : [])" />
				<slot name="suffix" :open="false" :set-open="() => {}" />
			</div>`,
		},
		FormControl: {
			props: ['modelValue', 'type', 'label', 'id', 'format', 'variant'],
			emits: ['update:modelValue'],
			template: `<input :id="id" :data-type="type" :data-label="label" :data-variant="variant"
				:value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
		},
	}
})

const { routeQuery, routerReplace } = vi.hoisted(() => ({
	routeQuery: { value: {} as Record<string, string> },
	routerReplace: vi.fn(),
}))
const { createDialog } = vi.hoisted(() => ({ createDialog: vi.fn() }))
vi.mock('@/utils/dialogs', () => ({ createDialog }))
const { openSettings } = vi.hoisted(() => ({ openSettings: vi.fn() }))
vi.mock('@/utils', () => ({ openSettings }))

vi.mock('vue-router', () => ({
	useRoute: () => ({ query: routeQuery.value }),
	useRouter: () => ({ replace: routerReplace }),
}))

String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

const EVALUATOR = 'eva@example.com'

const find = (url: string) => resources.value.find((r) => r.config.url === url)

interface MountOptions {
	viewer?: { name: string; username: string; is_moderator?: boolean }
	googleEnabled?: boolean
	canConfigureGoogle?: boolean
	calendar?: Record<string, unknown> | null
	invites?: boolean
	canConfigureInvites?: boolean
	timeOff?: [string | null, string | null]
	schedule?: Record<string, unknown>[]
	loaded?: boolean
	attach?: boolean
}

const MONDAY = [
	{ name: 2, day: 'Monday', start_time: '14:00:00', end_time: '15:00:00' },
	{ name: 1, day: 'Monday', start_time: '9:00:00', end_time: '10:00:00' },
]

async function mountPanel(options: MountOptions = {}) {
	const {
		viewer = { name: EVALUATOR, username: 'eva' },
		googleEnabled = true,
		canConfigureGoogle = false,
		calendar = null,
		invites = true,
		canConfigureInvites = false,
		timeOff = [null, null],
		schedule = MONDAY,
		loaded = true,
		attach = false,
	} = options
	resources.value = []
	const { default: ProfileEvaluator } = await import(
		'@/pages/ProfileEvaluator.vue'
	)
	const wrapper = mount(ProfileEvaluator, {
		attachTo: attach ? document.body : undefined,
		props: { profile: { data: { name: EVALUATOR, username: 'eva' } } },
		global: {
			provide: { $user: { data: { ...viewer, is_evaluator: true } } },
			mocks: { __: (s: string) => s },
		},
	})
	if (!loaded) return wrapper
	find('lms.lms.api.get_evaluator_details').data = {
		slots: {
			evaluator: EVALUATOR,
			schedule,
			unavailable_from: timeOff[0],
			unavailable_to: timeOff[1],
		},
		calendar,
		google_enabled: googleEnabled,
		can_configure_google: canConfigureGoogle,
		evaluation_invites: invites,
		can_configure_invites: canConfigureInvites,
		timezone: 'Asia/Kolkata (GMT+5:30)',
	}
	await flushPromises()
	return wrapper
}

const day = (wrapper: VueWrapper, name: string) =>
	wrapper.find(`[data-testid="day-${name}"]`)

const button = (wrapper: VueWrapper, label: string) =>
	wrapper.findAll('button').find((b) => b.text() === label)

const isOff = (wrapper: VueWrapper, name: string) =>
	day(wrapper, name).find('span').classes().includes('text-ink-gray-6') &&
	!day(wrapper, name).find('[data-testid="range"]').exists()

const addSlot = (wrapper: VueWrapper, name: string) =>
	day(wrapper, name).find(`button[aria-label="Add slot for ${name}"]`)

const addHours = (wrapper: VueWrapper, name: string) =>
	addSlot(wrapper, name).trigger('click')

const clearDay = async (wrapper: VueWrapper, name: string) => {
	for (const remove of day(wrapper, name).findAll(
		'button[data-icon="lucide-x"]'
	)) {
		await remove.trigger('click')
	}
}

const timesOf = (wrapper: VueWrapper, name: string) =>
	day(wrapper, name)
		.findAll('input[data-type="time"]')
		.map((i) => (i.element as HTMLInputElement).value)

const timeOffInput = (wrapper: VueWrapper) =>
	wrapper.find('[data-testid="time-off"] input[data-type="range"]')

const setTimeOff = (wrapper: VueWrapper, from: string, to: string) =>
	timeOffInput(wrapper).setValue(from ? `${from},${to}` : '')

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
afterEach(() => vi.useRealTimers())
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
		expect(isOff(wrapper, 'Tuesday')).toBe(true)
		expect(wrapper.find('[data-testid="hours"]').text()).toContain(
			'Times are in Asia/Kolkata (GMT+5:30).'
		)
	})

	it('names every control for screen readers', async () => {
		const wrapper = await mountPanel()
		const monday = day(wrapper, 'Monday')

		const adds = monday.findAll('button[aria-label^="Add slot"]')
		expect(adds).toHaveLength(1)
		expect(adds[0].attributes('aria-label')).toBe('Add slot for Monday')
		expect(adds[0].text()).toBe('Add slot')
		expect(adds[0].attributes('data-variant')).toBe('outline')
		expect(adds[0].find('.lucide-plus').exists()).toBe(true)
		expect(adds[0].element.parentElement!.lastElementChild).toBe(
			adds[0].element
		)
		expect(day(wrapper, 'Sunday').find('span').text()).toBe('Sunday')
		expect(addSlot(wrapper, 'Sunday').exists()).toBe(true)
		expect(day(wrapper, 'Sunday').find('[data-testid="range"]').exists()).toBe(
			false
		)
		expect(monday.find('[role="switch"]').exists()).toBe(false)
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
		expect(remove.element.parentElement).toBe(
			range.findAll('input')[1].element.parentElement
		)
	})

	it('changes nothing on the server until Save', async () => {
		const wrapper = await mountPanel()
		expect(button(wrapper, 'Discard')).toBeUndefined()
		expect(button(wrapper, 'Save')!.attributes('disabled')).toBeDefined()

		await addHours(wrapper, 'Tuesday')
		await day(wrapper, 'Monday')
			.find('button[data-icon="lucide-x"]')
			.trigger('click')

		expect(writes()).toEqual([])
		expect(toast.success).not.toHaveBeenCalled()
		expect(button(wrapper, 'Discard')).toBeTruthy()
		expect(button(wrapper, 'Save')!.attributes('disabled')).toBeUndefined()
	})

	it('totals each day, live, and leaves an empty day blank', async () => {
		const wrapper = await mountPanel()
		const total = (name: string) =>
			day(wrapper, name).find('[data-testid="total"]').text()

		expect(total('Monday')).toBe('2h')
		expect(total('Friday')).toBe('')
		await addHours(wrapper, 'Friday')
		expect(total('Friday')).toBe('8h')
	})

	it('labels the columns like the CRM schedule, with a divider only between days', async () => {
		const wrapper = await mountPanel()
		const header = wrapper.find('[data-testid="week-header"]')
		const list = day(wrapper, 'Monday').element.parentElement!

		expect(header.findAll('span').map((s) => s.text())).toEqual([
			'Day',
			'Total',
			'Hours',
		])
		expect(list.querySelectorAll('hr')).toHaveLength(6)
		expect(day(wrapper, 'Sunday').find('hr').exists()).toBe(false)
	})

	it('Add slot on an unavailable day adds 09:00 to 17:00, then the next hour', async () => {
		const wrapper = await mountPanel()
		expect(isOff(wrapper, 'Friday')).toBe(true)
		await addHours(wrapper, 'Friday')
		expect(isOff(wrapper, 'Friday')).toBe(false)
		await addHours(wrapper, 'Friday')

		expect(timesOf(wrapper, 'Friday')).toEqual([
			'09:00',
			'17:00',
			'17:00',
			'18:00',
		])
	})

	it('Discard puts back what was saved', async () => {
		const wrapper = await mountPanel({
			schedule: [
				...MONDAY,
				{
					name: 3,
					day: 'Tuesday',
					start_time: '9:00:00',
					end_time: '10:00:00',
				},
			],
		})
		await clearDay(wrapper, 'Monday')
		expect(isOff(wrapper, 'Monday')).toBe(true)
		expect(addSlot(wrapper, 'Monday').exists()).toBe(true)

		await button(wrapper, 'Discard')!.trigger('click')

		expect(
			day(wrapper, 'Monday').findAll('[data-testid="range"]')
		).toHaveLength(2)
		expect(button(wrapper, 'Discard')).toBeUndefined()
	})

	it('saves the whole week and the time off in one call, with one toast', async () => {
		const wrapper = await mountPanel()
		const details = find('lms.lms.api.get_evaluator_details')
		const save = find('lms.lms.api.save_evaluator_availability')
		const saved = { ...details.data }
		save.submit.mockResolvedValueOnce(saved)
		await addHours(wrapper, 'Wednesday')
		await setTimeOff(wrapper, '2030-01-01', '2030-01-05')

		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

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
		expect(details.setData).toHaveBeenCalledWith(saved)
		expect(details.reload).not.toHaveBeenCalled()
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
		await addHours(wrapper, 'Friday')

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

	it('draws every field on the page as outline', async () => {
		const wrapper = await mountPanel({
			timeOff: ['2030-01-01', '2030-01-05'],
		})
		const fields = wrapper.findAll('input, [data-testid="range-picker"]')
		const variants = fields
			.filter((f) => f.attributes('role') !== 'switch')
			.filter((f) => f.attributes('data-type') !== 'range')
			.map((f) => f.attributes('data-variant'))
		expect(variants.length).toBeGreaterThanOrEqual(4)
		expect(new Set(variants)).toEqual(new Set(['outline']))
	})

	it('never writes through raw framework endpoints', async () => {
		await mountPanel()
		const raw = resources.value.filter((r) =>
			String(r.config.url).startsWith('frappe.')
		)
		expect(raw).toEqual([])
	})
})

describe('ProfileEvaluator while loading', () => {
	it('shows a skeleton week, not seven unavailable days', async () => {
		const wrapper = await mountPanel({ loaded: false })
		const loading = wrapper.find('[data-testid="week-loading"]')

		expect(loading.attributes('aria-busy')).toBe('true')
		expect(loading.findAll('li')).toHaveLength(7)
		expect(loading.findAll('hr')).toHaveLength(6)
		expect(loading.findAll('[data-testid="skeleton"]')).toHaveLength(28)
		expect(wrapper.findAll('[data-testid^="day-"]')).toHaveLength(0)
		expect(wrapper.find('[data-testid="empty-week"]').exists()).toBe(false)
	})

	it('offers Retry, and no way to edit, when the week fails to load', async () => {
		const wrapper = await mountPanel({ loaded: false })
		const details = find('lms.lms.api.get_evaluator_details')
		details.error = { messages: ['Server error'] }
		await flushPromises()

		const error = wrapper.find('[data-testid="week-error"]')
		expect(error.text()).toContain('Could not load hours')
		expect(wrapper.find('[data-testid="week-loading"]').exists()).toBe(false)
		expect(wrapper.findAll('[data-testid^="day-"]')).toHaveLength(0)
		expect(wrapper.find('[data-testid="time-off"]').exists()).toBe(false)
		expect(button(wrapper, 'Save')).toBeUndefined()
		expect(button(wrapper, 'Discard')).toBeUndefined()

		await button(wrapper, 'Retry')!.trigger('click')
		expect(details.reload).toHaveBeenCalledTimes(1)
	})
})

describe('ProfileEvaluator with no saved hours', () => {
	const emptyState = (wrapper: VueWrapper) =>
		wrapper.find('[data-testid="empty-week"]')

	it('shows an empty state, and its button reveals the week', async () => {
		const wrapper = await mountPanel({ schedule: [] })

		expect(emptyState(wrapper).text()).toContain('No hours yet')
		expect(emptyState(wrapper).text()).toContain(
			"Students can't book an evaluation with you until you add hours."
		)
		expect(wrapper.findAll('[data-testid^="day-"]')).toHaveLength(0)

		expect(
			button(wrapper, 'Use Mon–Fri, 09:00–17:00')!.attributes('data-variant')
		).toBe('subtle')
		expect(button(wrapper, 'Set day by day')!.attributes('data-variant')).toBe(
			'outline'
		)
		expect(
			emptyState(wrapper).find('button[data-variant="solid"]').exists()
		).toBe(false)

		await button(wrapper, 'Set day by day')!.trigger('click')

		expect(emptyState(wrapper).exists()).toBe(false)
		expect(wrapper.findAll('[data-testid^="day-"]')).toHaveLength(7)
	})

	it('comes back when the last hours are removed, with Save still on', async () => {
		const wrapper = await mountPanel()

		await clearDay(wrapper, 'Monday')

		expect(emptyState(wrapper).text()).toContain('No hours yet')
		expect(wrapper.findAll('[data-testid^="day-"]')).toHaveLength(0)
		expect(button(wrapper, 'Save')!.attributes('disabled')).toBeUndefined()
	})

	it('stays on the week while setting it up day by day', async () => {
		const wrapper = await mountPanel({ schedule: [] })
		await button(wrapper, 'Set day by day')!.trigger('click')
		await addHours(wrapper, 'Monday')
		await clearDay(wrapper, 'Monday')

		expect(emptyState(wrapper).exists()).toBe(false)
		expect(wrapper.findAll('[data-testid^="day-"]')).toHaveLength(7)
	})

	it('stages 9:00–17:00 on weekdays from the empty state, unsaved', async () => {
		const wrapper = await mountPanel({ schedule: [] })

		await button(wrapper, 'Use Mon–Fri, 09:00–17:00')!.trigger('click')

		for (const name of [
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
		]) {
			expect(timesOf(wrapper, name)).toEqual(['09:00', '17:00'])
		}
		expect(isOff(wrapper, 'Saturday')).toBe(true)
		expect(isOff(wrapper, 'Sunday')).toBe(true)
		expect(writes()).toEqual([])
		expect(button(wrapper, 'Save')!.attributes('disabled')).toBeUndefined()

		await button(wrapper, 'Discard')!.trigger('click')
		expect(emptyState(wrapper).exists()).toBe(true)
	})

	it('saves the weekday preset as five wall-clock rows', async () => {
		const wrapper = await mountPanel({ schedule: [] })
		await button(wrapper, 'Use Mon–Fri, 09:00–17:00')!.trigger('click')

		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		const save = find('lms.lms.api.save_evaluator_availability')
		expect(save.submit.mock.calls[0][0].schedule).toEqual(
			['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => ({
				day: d,
				start_time: '09:00',
				end_time: '17:00',
			}))
		)
	})

	it('goes back to the empty state on Discard', async () => {
		const wrapper = await mountPanel({ schedule: [] })
		await button(wrapper, 'Set day by day')!.trigger('click')
		await addHours(wrapper, 'Monday')

		await button(wrapper, 'Discard')!.trigger('click')

		expect(emptyState(wrapper).exists()).toBe(true)
	})

	it('goes back to the empty state when zero ranges are saved', async () => {
		const wrapper = await mountPanel()
		const details = find('lms.lms.api.get_evaluator_details')
		const save = find('lms.lms.api.save_evaluator_availability')
		save.submit.mockResolvedValueOnce({
			...details.data,
			slots: { ...details.data.slots, schedule: [] },
		})
		await clearDay(wrapper, 'Monday')

		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		expect(save.submit.mock.calls[0][0].schedule).toEqual([])
		expect(emptyState(wrapper).exists()).toBe(true)
	})

	it("says so without a button on someone else's profile", async () => {
		const wrapper = await mountPanel({
			schedule: [],
			viewer: { name: 'mod@example.com', username: 'mod', is_moderator: true },
		})

		expect(emptyState(wrapper).text()).toContain('No hours set')
		expect(emptyState(wrapper).find('button').exists()).toBe(false)
	})
})

describe('ProfileEvaluator time off', () => {
	const part = (wrapper: VueWrapper) => wrapper.find('[data-testid="time-off"]')
	const picker = (wrapper: VueWrapper) =>
		part(wrapper).find('[data-testid="range-picker"]')

	it('is one labelled row with a clearable range field, no empty state', async () => {
		const wrapper = await mountPanel()

		expect(part(wrapper).find('h3').text()).toBe('Time off')
		expect(part(wrapper).text()).toContain(
			"Learners can't book you during time off."
		)
		expect(part(wrapper).findAll('[data-testid="range-picker"]')).toHaveLength(
			1
		)
		expect(picker(wrapper).attributes()).toMatchObject({
			'data-placeholder': 'Select dates',
			'data-variant': 'outline',
		})
		expect(part(wrapper).find('[aria-label="Clear time off"]').exists()).toBe(
			false
		)
		const id = timeOffInput(wrapper).attributes('id')
		expect(part(wrapper).find(`label[for="${id}"]`).text()).toBe('Time off')
		expect(part(wrapper).findAll('button')).toHaveLength(0)
		expect(part(wrapper).text()).not.toContain('No time off')
	})

	it('keeps the picked dates when the field loses focus', async () => {
		const { DateRangePicker } = await vi.importActual<any>('frappe-ui')
		const wrapper = await mountPanel()
		const format = picker(wrapper).attributes('data-format')
		const real = mount(DateRangePicker, {
			props: { modelValue: ['2026-10-27', '2026-10-29'], format },
			attachTo: document.body,
		})

		const input = real.find('input')
		expect((input.element as HTMLInputElement).value).toContain('Oct 27')
		await input.trigger('focus')
		await input.trigger('blur')
		await flushPromises()

		const emitted = real.emitted('update:modelValue') || []
		expect(emitted.at(-1) ?? [['2026-10-27', '2026-10-29']]).toEqual([
			['2026-10-27', '2026-10-29'],
		])
	})

	it('is hidden until the week has hours', async () => {
		const wrapper = await mountPanel({ schedule: [] })

		expect(part(wrapper).exists()).toBe(false)
		await button(wrapper, 'Use Mon–Fri, 09:00–17:00')!.trigger('click')
		expect(part(wrapper).exists()).toBe(true)
	})

	it('shows the saved range in the field', async () => {
		const wrapper = await mountPanel({
			timeOff: ['2030-02-10', '2030-02-20'],
		})

		expect((timeOffInput(wrapper).element as HTMLInputElement).value).toBe(
			'2030-02-10,2030-02-20'
		)
		expect(button(wrapper, 'Discard')).toBeUndefined()
	})

	// Upstream's Clear (#2928) saved at once; the × must only stage, like every edit
	// here. Added on feat/evaluator-availability-redesign (no PR yet) with the × button.
	it('clears a saved range with its × button, staged until Save', async () => {
		const wrapper = await mountPanel({
			timeOff: ['2030-01-01', '2030-01-05'],
		})
		const clear = part(wrapper).find('[aria-label="Clear time off"]')

		await clear.trigger('click')

		expect((timeOffInput(wrapper).element as HTMLInputElement).value).toBe('')
		expect(part(wrapper).find('[aria-label="Clear time off"]').exists()).toBe(
			false
		)
		expect(button(wrapper, 'Discard')).toBeDefined()
	})

	it('offers no × on someone else’s time off', async () => {
		const wrapper = await mountPanel({
			timeOff: ['2030-01-01', '2030-01-05'],
			viewer: { name: 'mod@example.com', username: 'mod', is_moderator: true },
		})

		expect(part(wrapper).find('[aria-label="Clear time off"]').exists()).toBe(
			false
		)
	})

	it('clearing a saved range is an edit that saves as no time off', async () => {
		const wrapper = await mountPanel({
			timeOff: ['2030-01-01', '2030-01-05'],
		})

		await setTimeOff(wrapper, '', '')
		expect(writes()).toEqual([])
		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		const save = find('lms.lms.api.save_evaluator_availability')
		expect(save.submit.mock.calls[0][0]).toMatchObject({
			unavailable_from: null,
			unavailable_to: null,
		})
	})

	it('saves no time off once the week has no hours', async () => {
		const wrapper = await mountPanel({
			timeOff: ['2030-01-01', '2030-01-05'],
		})
		await clearDay(wrapper, 'Monday')
		expect(part(wrapper).exists()).toBe(false)

		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		const save = find('lms.lms.api.save_evaluator_availability')
		expect(save.submit.mock.calls[0][0]).toEqual({
			schedule: [],
			unavailable_from: null,
			unavailable_to: null,
		})
	})

	it('Discard puts the saved range back', async () => {
		const wrapper = await mountPanel({
			timeOff: ['2030-01-01', '2030-01-05'],
		})
		await setTimeOff(wrapper, '2030-03-01', '2030-03-02')

		await button(wrapper, 'Discard')!.trigger('click')

		expect((timeOffInput(wrapper).element as HTMLInputElement).value).toBe(
			'2030-01-01,2030-01-05'
		)
		expect(button(wrapper, 'Discard')).toBeUndefined()
	})

	it('is read-only on someone else’s profile', async () => {
		const wrapper = await mountPanel({
			viewer: { name: 'mod@example.com', username: 'mod', is_moderator: true },
		})

		expect(part(wrapper).text()).toContain(
			"Learners can't book this evaluator during time off."
		)
		expect(timeOffInput(wrapper).attributes('disabled')).toBeDefined()
		expect(picker(wrapper).attributes('data-placeholder')).toBe('No time off')
	})
})

describe('ProfileEvaluator layout', () => {
	it('keeps hours and time off under one Availability section', async () => {
		const wrapper = await mountPanel()
		const section = wrapper.find('[data-testid="availability"]')

		expect(section.find('h2').text()).toBe('Availability')
		expect(section.findAll('h3').map((h) => h.text())).toEqual([
			'Hours',
			'Time off',
		])
		expect(section.find('[data-testid="hours"]').exists()).toBe(true)
		expect(section.find('[data-testid="time-off"]').exists()).toBe(true)
		expect(section.find('[data-testid="calendar"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(true)
		expect(wrapper.text().toLowerCase()).not.toContain('weekly')
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
		expect(isOff(wrapper, 'Tuesday')).toBe(true)
		expect(day(wrapper, 'Tuesday').text()).toBe('Tuesday')
		expect(wrapper.findAll('input:not([disabled])')).toHaveLength(0)
		expect(wrapper.find('button[aria-label^="Add slot"]').exists()).toBe(false)
		expect(button(wrapper, 'Save')).toBeUndefined()
		expect((timeOffInput(wrapper).element as HTMLInputElement).value).toBe(
			'2030-01-01,2030-01-05'
		)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(false)
	})

	it('shows the evaluator their own week read-only while the site updates', async () => {
		window.read_only_mode = true
		const wrapper = await mountPanel()

		expect(wrapper.findAll('input:not([disabled])')).toHaveLength(0)
		expect(button(wrapper, 'Save')).toBeUndefined()
		expect(wrapper.text()).toContain(
			"You can't change your availability while the site is updating."
		)
	})
})

describe('ProfileEvaluator Google Calendar', () => {
	const CONNECTED = {
		name: 'Eva evaluations',
		calendar_name: 'Eva evaluations',
		enable: 1,
		push_to_google_calendar: 1,
		is_authorized: true,
		connected: true,
	}
	const section = (wrapper: VueWrapper) =>
		wrapper.find('[data-testid="calendar"]')
	const status = (wrapper: VueWrapper) =>
		section(wrapper).find('[data-testid="calendar-status"]').text()
	const empty = (wrapper: VueWrapper) =>
		section(wrapper).find('[data-testid="calendar-empty"]')

	beforeEach(() => {
		createDialog.mockReset()
		openSettings.mockReset()
	})

	it('has no switches: connecting is the whole setting', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })

		expect(section(wrapper).find('[role="switch"]').exists()).toBe(false)
		expect(section(wrapper).text()).not.toContain('Use Google Calendar')
	})

	it('links an administrator to Google Settings when the site has no Google', async () => {
		const wrapper = await mountPanel({
			googleEnabled: false,
			canConfigureGoogle: true,
		})

		expect(status(wrapper)).toBe('Not connected')
		expect(empty(wrapper).text()).toContain("isn't set up on this site")
		const settings = button(wrapper, 'Open Google Settings')!
		expect(settings.attributes('data-href')).toBe('/app/google-settings')
		expect(button(wrapper, 'Connect')).toBeUndefined()
	})

	it('tells anyone else to ask an administrator, with no link', async () => {
		const wrapper = await mountPanel({ googleEnabled: false })

		expect(empty(wrapper).text()).toContain('Ask your site administrator')
		expect(empty(wrapper).find('button').exists()).toBe(false)
	})

	it.each([
		{ label: 'no calendar record', calendar: null },
		{
			label: 'a revoked or expired token',
			calendar: { ...CONNECTED, connected: false },
		},
	])('offers only Connect with $label', async ({ calendar }) => {
		const wrapper = await mountPanel({ calendar })

		expect(status(wrapper)).toBe('Not connected')
		expect(empty(wrapper).text()).toContain('Connect your Google Calendar')
		expect(
			empty(wrapper)
				.findAll('button')
				.map((b) => b.text())
		).toEqual(['Connect'])
		expect(button(wrapper, 'Disconnect')).toBeUndefined()
	})

	it('says invites are off without claiming a calendar is in use', async () => {
		const wrapper = await mountPanel({ invites: false })

		expect(empty(wrapper).text()).toContain('Evaluation invites are off')
		expect(empty(wrapper).text()).toContain('until a Moderator turns them on')
		expect(empty(wrapper).text()).not.toContain('Live classes')
		expect(section(wrapper).find('[role="alert"]').exists()).toBe(false)
	})

	it('tells a connected evaluator who cannot turn invites on to ask a Moderator, as an amber alert', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED, invites: false })
		const alert = section(wrapper).find('[data-testid="invites-off"]')

		expect(alert.attributes('data-theme')).toBe('amber')
		expect(alert.find('strong').text()).toBe(
			'Evaluation invites are off on this site'
		)
		expect(alert.find('p').text()).toBe(
			"Booked evaluations aren't added to this calendar. Contact a Moderator to turn them on."
		)
		expect(button(wrapper, 'Open Settings')).toBeUndefined()
	})

	it.each([
		{ invites: true, canConfigureInvites: false },
		{ invites: false, canConfigureInvites: true },
	])(
		'shows no alert when invites are on or the viewer can turn them on (%o)',
		async (options) => {
			const wrapper = await mountPanel({ calendar: CONNECTED, ...options })

			expect(section(wrapper).find('[role="alert"]').exists()).toBe(false)
		}
	)

	it('shows no alert on a disabled calendar', async () => {
		const wrapper = await mountPanel({
			calendar: { ...CONNECTED, enable: 0, connected: false },
			invites: false,
		})

		expect(section(wrapper).find('[role="alert"]').exists()).toBe(false)
		expect(section(wrapper).text()).toContain("while it's disabled")
	})

	it.each([
		{ calendar: null, where: 'not connected' },
		{ calendar: CONNECTED, where: 'connected' },
	])(
		'points an admin to the invites setting ($where)',
		async ({ calendar }) => {
			const wrapper = await mountPanel({
				calendar,
				invites: false,
				canConfigureInvites: true,
			})

			expect(section(wrapper).text()).toContain(
				'Turn on Send calendar invite for evaluations in Settings > General.'
			)
			await button(wrapper, 'Open Settings')!.trigger('click')
			expect(openSettings).toHaveBeenCalledWith(
				'general',
				null,
				'send_calendar_invite_for_evaluations'
			)
		}
	)

	it.each([
		{ invites: false, canConfigureInvites: false },
		{ invites: true, canConfigureInvites: true },
	])('offers no Settings link when it cannot help (%o)', async (options) => {
		const wrapper = await mountPanel(options)

		expect(button(wrapper, 'Open Settings')).toBeUndefined()
	})

	it('follows the setting as soon as an admin flips it', async () => {
		const { reactive } = await import('vue')
		lmsSettingsDoc.doc = reactive({ send_calendar_invite_for_evaluations: 0 })
		const wrapper = await mountPanel({
			calendar: CONNECTED,
			invites: false,
			canConfigureInvites: true,
		})
		expect(button(wrapper, 'Open Settings')).toBeDefined()

		lmsSettingsDoc.doc.send_calendar_invite_for_evaluations = 1
		await flushPromises()

		expect(button(wrapper, 'Open Settings')).toBeUndefined()
		expect(section(wrapper).text()).toContain(
			'added to this calendar with a Google Meet link'
		)
		lmsSettingsDoc.doc = undefined
	})

	it('never loads LMS Settings for a viewer who cannot change it', async () => {
		lmsSettingsDoc.config = null
		await mountPanel({ invites: false })

		expect(lmsSettingsDoc.config).toBeNull()
	})

	it("never loads LMS Settings on another evaluator's profile", async () => {
		lmsSettingsDoc.config = null
		await mountPanel({
			viewer: { name: 'mod@example.com', username: 'mod', is_moderator: true },
			invites: false,
			canConfigureInvites: true,
		})

		expect(lmsSettingsDoc.config).toBeNull()
	})

	it('Connect starts Google sign-in', async () => {
		const wrapper = await mountPanel()
		await button(wrapper, 'Connect')!.trigger('click')

		expect(
			find('lms.lms.api.authorize_evaluator_calendar').submit
		).toHaveBeenCalled()
	})

	it.each([
		{ invites: true, says: 'added to this calendar with a Google Meet link' },
		{ invites: false, says: 'Evaluation invites are off' },
	])(
		'shows the connected calendar by name (invites on: $invites)',
		async ({ invites, says }) => {
			const wrapper = await mountPanel({ calendar: CONNECTED, invites })
			const row = section(wrapper).find('[data-testid="calendar-connected"]')

			expect(status(wrapper)).toBe('Connected')
			expect(row.text()).toContain('Eva evaluations')
			expect(section(wrapper).text()).toContain(says)
			expect(empty(wrapper).exists()).toBe(false)
			expect(button(wrapper, 'Connect')).toBeUndefined()
			expect(button(wrapper, 'Reconnect')).toBeUndefined()
		}
	)

	it('puts the status next to the heading, not the button', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })
		const heading = section(wrapper).find('h2').element.parentElement!

		expect(
			heading.querySelector('[data-testid="calendar-status"]')
		).not.toBeNull()
	})

	// Branch-only code, no upstream PR: the returned calendar is patched into the
	// details, not refetched. Added on feat/evaluator-availability-redesign (no PR yet).
	it('disconnects only after confirming, then shows the returned calendar', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })
		const disconnect = find('lms.lms.api.disconnect_evaluator_calendar')

		await button(wrapper, 'Disconnect')!.trigger('click')
		expect(disconnect.submit).not.toHaveBeenCalled()
		expect(createDialog).toHaveBeenCalledTimes(1)

		const close = vi.fn()
		const [action] = createDialog.mock.calls[0][0].actions
		expect(action.label).toBe('Disconnect')
		action.onClick({ close })

		expect(close).toHaveBeenCalled()
		expect(disconnect.submit).toHaveBeenCalledWith()
		const details = find('lms.lms.api.get_evaluator_details')
		const disconnected = {
			...CONNECTED,
			connected: false,
			is_authorized: false,
		}
		disconnect.config.onSuccess(disconnected)
		await flushPromises()

		expect(details.reload).not.toHaveBeenCalled()
		expect(details.data.calendar).toEqual(disconnected)
		expect(details.data.slots.schedule).toHaveLength(MONDAY.length)
		expect(status(wrapper)).not.toBe('Connected')
	})

	const DISABLED = { ...CONNECTED, enable: 0, connected: false }

	it('keeps a disabled calendar with its name and an Enable button', async () => {
		const wrapper = await mountPanel({ calendar: DISABLED })
		const row = section(wrapper).find('[data-testid="calendar-connected"]')

		expect(status(wrapper)).toBe('Disabled')
		expect(row.text()).toContain('Eva evaluations')
		expect(section(wrapper).text()).toContain("while it's disabled")
		expect(button(wrapper, 'Enable')).toBeDefined()
		expect(button(wrapper, 'Disable')).toBeUndefined()
		expect(button(wrapper, 'Disconnect')).toBeDefined()
		expect(empty(wrapper).exists()).toBe(false)
	})

	it('Disable turns the calendar off and shows the returned one', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })
		const update = find('lms.lms.api.update_evaluator_calendar')
		update.submit.mockResolvedValueOnce(DISABLED)

		await button(wrapper, 'Disable')!.trigger('click')
		await flushPromises()

		expect(update.submit).toHaveBeenCalledTimes(1)
		expect(update.submit).toHaveBeenCalledWith({
			fieldname: 'enable',
			value: 0,
		})
		expect(createDialog).not.toHaveBeenCalled()
		expect(
			find('lms.lms.api.get_evaluator_details').reload
		).not.toHaveBeenCalled()
		expect(status(wrapper)).toBe('Disabled')
		expect(button(wrapper, 'Enable')).toBeDefined()
		expect(toast.success).toHaveBeenCalledWith('Google Calendar disabled')
	})

	it.each([
		{ push: 1, calls: [{ fieldname: 'enable', value: 1 }] },
		{
			push: 0,
			calls: [
				{ fieldname: 'enable', value: 1 },
				{ fieldname: 'push_to_google_calendar', value: 1 },
			],
		},
	])(
		'Enable turns the calendar back on (push $push)',
		async ({ push, calls }) => {
			const wrapper = await mountPanel({
				calendar: {
					...DISABLED,
					enable: push ? 0 : 1,
					push_to_google_calendar: push,
				},
			})
			const update = find('lms.lms.api.update_evaluator_calendar')
			update.submit.mockResolvedValue(CONNECTED)

			await button(wrapper, 'Enable')!.trigger('click')
			await flushPromises()

			expect(
				update.submit.mock.calls.map(([params]: unknown[]) => params)
			).toEqual(calls)
			expect(status(wrapper)).toBe('Connected')
			expect(button(wrapper, 'Disable')).toBeDefined()
		}
	)

	it('shows Connect when Enable finds the sign-in no longer works', async () => {
		const wrapper = await mountPanel({ calendar: DISABLED })
		find('lms.lms.api.update_evaluator_calendar').submit.mockResolvedValueOnce({
			...CONNECTED,
			connected: false,
		})

		await button(wrapper, 'Enable')!.trigger('click')
		await flushPromises()

		expect(status(wrapper)).toBe('Not connected')
		expect(button(wrapper, 'Connect')).toBeDefined()
	})

	it('says so when Disable fails, and keeps the calendar on', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })
		find('lms.lms.api.update_evaluator_calendar').submit.mockRejectedValueOnce(
			new Error('Google Calendar is not set up')
		)

		await button(wrapper, 'Disable')!.trigger('click')
		await flushPromises()

		expect(toast.error).toHaveBeenCalled()
		expect(status(wrapper)).toBe('Connected')
	})

	it('draws Disconnect as outline, a level apart from Disable', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })

		expect(
			button(wrapper, 'Disable')!.attributes('data-variant')
		).toBeUndefined()
		expect(button(wrapper, 'Disconnect')!.attributes('data-variant')).toBe(
			'outline'
		)
	})

	describe('rename', () => {
		const RENAMED = {
			...CONNECTED,
			name: 'Eva marking',
			calendar_name: 'Eva marking',
		}
		const pencil = (wrapper: VueWrapper) =>
			section(wrapper).find('button[aria-label="Rename calendar"]')
		const field = (wrapper: VueWrapper) =>
			section(wrapper).find('[data-testid="text-input"]')
		const nameShown = (wrapper: VueWrapper) =>
			section(wrapper).find('[data-testid="calendar-name"]')
		const openField = async () => {
			const wrapper = await mountPanel({ calendar: CONNECTED, attach: true })
			await pencil(wrapper).trigger('click')
			await flushPromises()
			return wrapper
		}
		const update = () => find('lms.lms.api.update_evaluator_calendar')
		const renames = () =>
			resources.value.filter(
				(r) =>
					r.config.url === 'lms.lms.api.update_evaluator_calendar' &&
					r.submit.mock.calls.length
			)

		it('opens a focused field holding the selected name', async () => {
			const wrapper = await openField()
			const input = field(wrapper).element as HTMLInputElement

			expect(nameShown(wrapper).exists()).toBe(false)
			expect(input.value).toBe('Eva evaluations')
			expect(document.activeElement).toBe(input)
			expect(input.selectionStart).toBe(0)
			expect(input.selectionEnd).toBe('Eva evaluations'.length)
		})

		it('opens on a double-click of the name too', async () => {
			const wrapper = await mountPanel({ calendar: DISABLED, attach: true })
			await nameShown(wrapper).trigger('dblclick')
			await flushPromises()

			expect(document.activeElement).toBe(field(wrapper).element)
		})

		it('saves on Enter and shows the returned calendar', async () => {
			const wrapper = await openField()
			const rename = resources.value.filter(
				(r) => r.config.url === 'lms.lms.api.update_evaluator_calendar'
			)[1]
			rename.submit.mockResolvedValueOnce(RENAMED)

			await field(wrapper).setValue('  Eva marking ')
			await field(wrapper).trigger('keydown', { key: 'Enter' })
			await flushPromises()

			expect(rename.submit).toHaveBeenCalledTimes(1)
			expect(rename.submit).toHaveBeenCalledWith({
				fieldname: 'calendar_name',
				value: 'Eva marking',
			})
			expect(update().submit).not.toHaveBeenCalled()
			expect(field(wrapper).exists()).toBe(false)
			expect(nameShown(wrapper).text()).toBe('Eva marking')
			expect(toast.success).toHaveBeenCalledWith('Calendar renamed')
		})

		it('shows a check in place of the pencil that saves once', async () => {
			const wrapper = await openField()
			const rename = resources.value.filter(
				(r) => r.config.url === 'lms.lms.api.update_evaluator_calendar'
			)[1]
			rename.submit.mockResolvedValueOnce(RENAMED)
			const check = section(wrapper).find('button[aria-label="Save name"]')

			expect(pencil(wrapper).exists()).toBe(false)
			await field(wrapper).setValue('Eva marking')
			// A browser blurs the field on mousedown unless it is prevented.
			const down = new MouseEvent('mousedown', { cancelable: true })
			check.element.dispatchEvent(down)
			if (!down.defaultPrevented) await field(wrapper).trigger('blur')
			await check.trigger('click')
			await flushPromises()

			expect(down.defaultPrevented).toBe(true)
			expect(rename.submit).toHaveBeenCalledTimes(1)
			expect(rename.submit).toHaveBeenCalledWith({
				fieldname: 'calendar_name',
				value: 'Eva marking',
			})
			expect(nameShown(wrapper).text()).toBe('Eva marking')
		})

		it('hides the pencil until hover or keyboard focus', async () => {
			const wrapper = await mountPanel({ calendar: CONNECTED })

			expect(
				section(wrapper).find('[data-testid="calendar-connected"]').classes()
			).toContain('group')
			expect(pencil(wrapper).classes()).toEqual(
				expect.arrayContaining([
					'focus-visible:opacity-100',
					'[@media(hover:hover)]:opacity-0',
					'[@media(hover:hover)]:group-hover:opacity-100',
				])
			)
		})

		it('Escape puts the name back without a request', async () => {
			const wrapper = await openField()

			await field(wrapper).setValue('Something else')
			await field(wrapper).trigger('keydown', { key: 'Escape' })
			await flushPromises()

			expect(field(wrapper).exists()).toBe(false)
			expect(nameShown(wrapper).text()).toBe('Eva evaluations')
			expect(renames()).toHaveLength(0)
		})

		it.each(['Eva evaluations', '   '])(
			'sends nothing for %j',
			async (value) => {
				const wrapper = await openField()

				await field(wrapper).setValue(value)
				await field(wrapper).trigger('blur')
				await flushPromises()

				expect(field(wrapper).exists()).toBe(false)
				expect(nameShown(wrapper).text()).toBe('Eva evaluations')
				expect(renames()).toHaveLength(0)
			}
		)

		it('keeps the field open with the typed name when the save fails', async () => {
			const wrapper = await openField()
			const rename = resources.value.filter(
				(r) => r.config.url === 'lms.lms.api.update_evaluator_calendar'
			)[1]
			rename.submit.mockRejectedValueOnce(
				new Error('Another calendar already has this name.')
			)

			await field(wrapper).setValue('Taken')
			await field(wrapper).trigger('blur')
			await flushPromises()

			expect(toast.error).toHaveBeenCalled()
			expect(toast.success).not.toHaveBeenCalled()
			expect((field(wrapper).element as HTMLInputElement).value).toBe('Taken')
			expect(document.activeElement).toBe(field(wrapper).element)
		})

		it('disables the field while saving', async () => {
			const wrapper = await openField()
			const rename = resources.value.filter(
				(r) => r.config.url === 'lms.lms.api.update_evaluator_calendar'
			)[1]
			rename.loading = true
			await flushPromises()

			expect(field(wrapper).attributes('disabled')).toBeDefined()
			await field(wrapper).trigger('blur')
			expect(rename.submit).not.toHaveBeenCalled()
		})
	})

	it('keeps unsaved hours through Disable and Disconnect', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })
		await addHours(wrapper, 'Friday')
		const hours = timesOf(wrapper, 'Friday')
		const update = find('lms.lms.api.update_evaluator_calendar')
		update.submit.mockResolvedValueOnce(DISABLED)

		expect(
			button(wrapper, 'Disconnect')!.attributes('disabled')
		).toBeUndefined()
		await button(wrapper, 'Disable')!.trigger('click')
		await flushPromises()
		find('lms.lms.api.disconnect_evaluator_calendar').config.onSuccess({
			...DISABLED,
			is_authorized: false,
		})
		await flushPromises()

		expect(hours.length).toBeGreaterThan(0)
		expect(timesOf(wrapper, 'Friday')).toEqual(hours)
		expect(button(wrapper, 'Save')!.attributes('disabled')).toBeUndefined()
	})

	it('Save writes availability only, never the calendar', async () => {
		const wrapper = await mountPanel({ calendar: CONNECTED })
		await addHours(wrapper, 'Friday')
		await button(wrapper, 'Save')!.trigger('click')
		await flushPromises()

		expect(writes().map((r) => r.config.url)).toEqual([
			'lms.lms.api.save_evaluator_availability',
		])
	})

	it('holds Connect until unsaved changes are saved', async () => {
		const wrapper = await mountPanel()
		expect(button(wrapper, 'Connect')!.attributes('disabled')).toBeUndefined()

		await addHours(wrapper, 'Friday')

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
