/**
 * Tests for ProfileEvaluator.vue: the evaluator availability panel.
 *
 * Focus: every write goes through the ownership-checked `lms.lms.api`
 * endpoints. It used to call `frappe.client.insert` / `set_value` / `delete`
 * directly, which fall back to Course Evaluator's role permissions. Those
 * grant blanket write to Moderator, Batch Evaluator and Course Creator with no
 * owner condition, so any of them could edit any other evaluator's calendar.
 *
 * Also guards the unavailability dates: they were wired with `@blur`, but the
 * date control renders as a popover, so the write has to hang off
 * `@update:modelValue` to be reached at all.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { resources } = vi.hoisted(() => ({ resources: { value: [] as any[] } }))

vi.mock('frappe-ui', () => ({
	createResource: (config: any) => {
		const res: any = { loading: false, config, data: null }
		res.submit = vi.fn((values: any) => {
			res.lastParams = config.makeParams ? config.makeParams(values) : values
		})
		res.reload = vi.fn()
		resources.value.push(res)
		return res
	},
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
	Button: {
		props: ['label'],
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot /></button>`,
	},
	Badge: { template: `<span><slot /></span>` },
	FormControl: {
		props: ['modelValue', 'type', 'label', 'options', 'id', 'disabled'],
		emits: ['update:modelValue'],
		template: `<input :data-type="type" :data-label="label" :value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)" />`,
	},
}))

vi.mock('@/utils', () => ({ convertToTitleCase: (s: string) => s }))

const EVALUATOR = 'eva@example.com'

function findResource(url: string) {
	return resources.value.find((r) => r.config.url === url)
}

async function mountPanel(sessionUser = EVALUATOR) {
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
						data: { name: sessionUser, email: sessionUser, is_evaluator: true },
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
		is_authorized: false,
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

	it('sets unavailability through the ownership-checked endpoint', async () => {
		await mountPanel()
		const unavailability = findResource(
			'lms.lms.api.set_evaluator_unavailability'
		)
		expect(unavailability).toBeTruthy()

		unavailability.submit({ field: 'unavailable_from', value: '2026-08-01' })
		expect(unavailability.lastParams).toEqual({
			evaluator: EVALUATOR,
			fieldname: 'unavailable_from',
			value: '2026-08-01',
		})
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
})
