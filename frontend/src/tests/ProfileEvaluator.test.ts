/**
 * Tests for ProfileEvaluator.vue: the evaluator availability panel.
 *
 * Focus: every write goes through the ownership-checked `lms.lms.api`
 * endpoints. It used to call `frappe.client.insert` / `set_value` / `delete`
 * directly, which fall back to Course Evaluator's role permissions. Those
 * grant Moderator blanket write with no owner condition, so a Moderator could
 * edit any other evaluator's calendar.
 *
 * Also guards the unavailability dates: they were wired with `@blur`, but the
 * date control renders as a popover, so the write has to hang off
 * `@update:modelValue` to be reached at all.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { resources } = vi.hoisted(() => ({ resources: { value: [] as any[] } }))

vi.mock('frappe-ui', async () => {
	// Reactive, like the real resource, so seeding `data` re-renders the panel.
	const { reactive } = await import('vue')
	return {
		createResource: (config: any) => {
			const res: any = reactive({ loading: false, config, data: null })
			res.submit = vi.fn((values: any) => {
				res.lastParams = config.makeParams ? config.makeParams(values) : values
				return Promise.resolve()
			})
			res.reload = vi.fn()
			resources.value.push(res)
			return res
		},
		toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
		Button: {
			props: ['label'],
			emits: ['click'],
			template: `<button @click="$emit('click')">{{ label }}<slot /></button>`,
		},
		Badge: { props: ['label', 'theme'], template: `<span>{{ label }}</span>` },
		Switch: {
			props: ['modelValue'],
			emits: ['update:modelValue'],
			template: `<input type="checkbox" :checked="modelValue"
			@change="$emit('update:modelValue', $event.target.checked)" />`,
		},
		FormControl: {
			props: ['modelValue', 'type', 'label', 'options', 'id', 'disabled'],
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

vi.mock('@/utils', () => ({ convertToTitleCase: (s: string) => s }))

// translation.js installs String.prototype.format at app boot.
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

const EVALUATOR = 'eva@example.com'

function findResource(url: string) {
	return resources.value.find((r) => r.config.url === url)
}

async function mountPanel(
	sessionUser = EVALUATOR,
	sessionUsername = 'eva',
	isModerator = false
) {
	resources.value = []
	const wrapper = mount(
		await import('@/pages/ProfileEvaluator.vue').then((m) => m.default),
		{
			props: {
				profile: { data: { name: EVALUATOR, username: 'eva' } },
			},
			global: {
				provide: {
					$user: {
						data: {
							name: sessionUser,
							email: sessionUser,
							username: sessionUsername,
							is_evaluator: true,
							is_moderator: isModerator,
						},
					},
				},
				mocks: { __: (s: string) => s },
			},
		}
	)
	// The details resource is `auto`, so seed what the panel renders from.
	const details = findResource('lms.lms.api.get_evaluator_details')
	details.data = {
		slots: {
			name: EVALUATOR,
			schedule: [
				{ name: 42, day: 'Monday', start_time: '09:00', end_time: '10:00' },
			],
		},
		calendar: null,
		google_enabled: true,
	}
	await flushPromises()
	return wrapper
}

describe('ProfileEvaluator availability writes', () => {
	beforeEach(() => {
		vi.stubGlobal('__', (s: string) => s)
		resources.value = []
	})

	it('adds a slot through the ownership-checked endpoint', async () => {
		await mountPanel()
		const create = findResource('lms.lms.api.add_evaluator_slot')
		expect(create).toBeTruthy()
	})

	it('updates a slot through the ownership-checked endpoint', async () => {
		await mountPanel()
		const update = findResource('lms.lms.api.update_evaluator_slot')
		expect(update).toBeTruthy()

		update.submit({ name: 42, field: 'day', value: 'Friday' })
		expect(update.lastParams).toEqual({
			evaluator: EVALUATOR,
			slot: 42,
			fieldname: 'day',
			value: 'Friday',
		})
	})

	it('deletes a slot through the ownership-checked endpoint', async () => {
		await mountPanel()
		const remove = findResource('lms.lms.api.delete_evaluator_slot')
		expect(remove).toBeTruthy()

		remove.submit({ name: 42 })
		expect(remove.lastParams).toEqual({ evaluator: EVALUATOR, slot: 42 })
	})

	it('never writes availability through raw framework endpoints', async () => {
		await mountPanel()
		const raw = resources.value.filter((r) =>
			String(r.config.url).startsWith('frappe.client.')
		)
		expect(raw).toEqual([])
	})

	it('writes the unavailability date on change, not on blur', async () => {
		const wrapper = await mountPanel()
		const unavailability = findResource(
			'lms.lms.api.set_evaluator_unavailability'
		)

		await wrapper
			.findAll('button')
			.find((b) => b.text() === 'Add time off')!
			.trigger('click')
		const dateFields = wrapper.findAll('[data-type="date"]')
		expect(dateFields.length).toBe(2)

		await dateFields[0].setValue('2026-08-01')
		expect(unavailability.submit).toHaveBeenCalled()
		expect(unavailability.lastParams).toEqual({
			evaluator: EVALUATOR,
			fieldname: 'unavailable_from',
			value: '2026-08-01',
		})
	})

	// The watcher used to be deep, so a calendar toggle (which edits the loaded
	// details in place) put the last load's empty time off back over a date
	// the evaluator had just saved.
	it('keeps a saved time-off date when a calendar setting changes', async () => {
		const wrapper = await mountPanel()
		await wrapper
			.findAll('button')
			.find((b) => b.text() === 'Add time off')!
			.trigger('click')
		const from = wrapper.findAll('[data-type="date"]')[0]
		await from.setValue('2026-08-01')

		findResource('lms.lms.api.update_evaluator_calendar').config.onSuccess({
			enable: 1,
			push_to_google_calendar: 0,
			calendar_name: 'Eva',
			is_authorized: true,
		})
		await flushPromises()

		expect(
			(wrapper.findAll('[data-type="date"]')[0].element as HTMLInputElement)
				.value
		).toBe('2026-08-01')
	})

	it('names each slot control for screen readers', async () => {
		const wrapper = await mountPanel()
		// The mocked resource is not reactive, so re-render to pick up the seed.
		wrapper.vm.$forceUpdate()
		await flushPromises()
		const slot = wrapper.find('[data-testid="slot"]')
		const labels = slot.findAll('input').map((i) => i.attributes('aria-label'))
		expect(labels).toEqual(['Day', 'Start time', 'End time'])
		expect(slot.find('button').attributes('aria-label')).toBe('Remove Monday')
	})
})

// Portal evaluators have no Settings modal and no write permission on Google
// Calendar, so the Slots tab is where they manage it, through lms.lms.api only.
describe('ProfileEvaluator calendar settings', () => {
	beforeEach(() => {
		vi.stubGlobal('__', (s: string) => s)
		resources.value = []
		routeQuery.value = {}
		routerReplace.mockReset()
	})

	it('saves a toggled setting through the own-calendar endpoint', async () => {
		const wrapper = await mountPanel()
		const update = findResource('lms.lms.api.update_evaluator_calendar')

		await wrapper
			.find('input[aria-label="Push to Google Calendar"]')
			.setValue(false)

		expect(update.submit).toHaveBeenCalledTimes(1)
		expect(update.lastParams).toEqual({
			fieldname: 'push_to_google_calendar',
			value: 0,
		})
	})

	it("signs in through lms, not Frappe's desk-only authorize_access", async () => {
		await mountPanel()
		expect(
			findResource('lms.lms.api.authorize_evaluator_calendar')
		).toBeTruthy()
		const frappeEndpoints = resources.value.filter((r) =>
			String(r.config.url).startsWith('frappe.integrations.')
		)
		expect(frappeEndpoints).toEqual([])
	})

	it('has no Save button: every change saves itself', async () => {
		const wrapper = await mountPanel()
		const labels = wrapper.findAll('button').map((b) => b.text())
		expect(labels).not.toContain('Save')
	})

	it('hides the calendar from a Moderator viewing someone else', async () => {
		const wrapper = await mountPanel('mod@example.com', 'mod', true)
		expect(wrapper.find('[data-testid="calendar"]').exists()).toBe(false)
	})

	it('says so when Google did not finish signing in', async () => {
		routeQuery.value = { calendar: 'failed' }
		await mountPanel()
		const { toast } = await import('frappe-ui')
		expect(toast.error).toHaveBeenCalledWith(
			expect.stringContaining('Try authorizing again')
		)
		expect(routerReplace).toHaveBeenCalled()
	})

	// The profile carries no email, so the owner check matches on username.
	it('lets the evaluator edit their own slots, matched by username', async () => {
		const wrapper = await mountPanel()
		expect(wrapper.text()).toContain('Add slot')
	})

	it("keeps a moderator read-only on someone else's slots", async () => {
		const wrapper = await mountPanel('mod@example.com', 'mod', true)
		expect(wrapper.text()).not.toContain('Add slot')
	})
})
