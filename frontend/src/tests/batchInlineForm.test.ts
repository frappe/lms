import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'

const { state, toast, call, updateMetaInfo } = vi.hoisted(() => ({
	state: { serverDoc: {} as Record<string, unknown>, resource: null as any },
	toast: { success: vi.fn(), error: vi.fn() },
	call: vi.fn(() => Promise.resolve([])),
	updateMetaInfo: vi.fn(),
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createDocumentResource: () => {
			const resource = reactive({
				doc: null as Record<string, unknown> | null,
				reload: vi.fn(() => {
					resource.doc = structuredClone(state.serverDoc)
				}),
				setValue: { submit: vi.fn(() => Promise.resolve()) },
			})
			state.resource = resource
			return resource
		},
		call,
		toast,
	}
})
vi.mock('@/utils', () => ({
	getMetaInfo: vi.fn(() => Promise.resolve()),
	updateMetaInfo,
}))

import { useBatchForm } from '@/pages/Batches/composables/useBatchForm'
import type { BatchForm } from '@/pages/Batches/composables/useBatchForm'
import { missingBatchFields } from '@/utils/batchForm'

const completeDoc = () => ({
	name: 'B1',
	title: 'Spring batch',
	description: 'For new consultants',
	start_date: '2099-01-01',
	end_date: '2099-02-01',
	start_time: '9:00:00',
	end_time: '11:00:00',
	timezone: 'Asia/Kolkata',
	batch_details: '<p>Details</p>',
	instructors: [{ instructor: 'ash@example.com' }],
	courses: [{ course: 'C1' }],
	modified: '2026-01-01 10:00:00',
	paid_batch: 0,
})

const mountForm = async (): Promise<BatchForm> => {
	let form!: BatchForm
	const batch = reactive({ data: { name: 'B1' }, reload: vi.fn() })
	mount(
		defineComponent({
			setup() {
				form = useBatchForm(
					() => 'B1',
					batch as never,
					() => true
				)
				return () => h('div')
			},
		})
	)
	await flushPromises()
	return form
}

describe('the batch inline form', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		state.serverDoc = completeDoc()
	})
	afterEach(() => vi.useRealTimers())

	it('loads the doc clean, with times padded for the time pickers', async () => {
		const form = await mountForm()
		expect(form.doc.value?.start_time).toBe('09:00')
		expect(form.instructors.value).toEqual(['ash@example.com'])
		expect(form.isDirty.value).toBe(false)
	})

	it('turns dirty on an inline edit', async () => {
		const form = await mountForm()
		form.doc.value!.title = 'Summer batch'
		expect(form.isDirty.value).toBe(true)
	})

	it('names the gaps on a save and rings them until they are filled', async () => {
		const form = await mountForm()
		form.doc.value!.title = ''
		form.submitBatch()
		expect(toast.error).toHaveBeenCalledWith('Add title before saving.')
		expect(state.resource.setValue.submit).not.toHaveBeenCalled()
		expect(form.isMissing('title')).toBe(true)

		form.previewRequired(false)
		expect(form.isMissing('title')).toBe(true)

		form.doc.value!.title = 'Back again'
		await flushPromises()
		expect(form.showRequired.value).toBe(false)
	})

	it('rings the gaps only while Save is hovered', async () => {
		const form = await mountForm()
		form.doc.value!.description = ''
		form.previewRequired(true)
		expect(form.isMissing('description')).toBe(true)
		form.previewRequired(false)
		expect(form.isMissing('description')).toBe(false)
	})

	it('saves the fields it owns and leaves other child tables alone', async () => {
		const form = await mountForm()
		form.doc.value!.title = 'Summer batch'
		form.submitBatch()
		const [values] = state.resource.setValue.submit.mock.calls[0]
		expect(values.title).toBe('Summer batch')
		expect(values.instructors).toEqual([{ instructor: 'ash@example.com' }])
		expect(values).not.toHaveProperty('courses')
		expect(values).not.toHaveProperty('modified')
	})

	it('waits for Save instead of saving edits on its own', async () => {
		const form = await mountForm()
		form.doc.value!.title = 'Summer batch'
		await flushPromises()
		vi.advanceTimersByTime(5000)
		expect(state.resource.setValue.submit).not.toHaveBeenCalled()
		expect(form.isDirty.value).toBe(true)
		form.submitBatch()
		expect(state.resource.setValue.submit).toHaveBeenCalledTimes(1)
	})

	it('resolves true once a save succeeds, for Save and leave', async () => {
		const form = await mountForm()
		state.resource.setValue.submit.mockImplementationOnce(
			(_values: unknown, options: { onSuccess: (doc: unknown) => void }) => {
				options.onSuccess({ name: 'B1' })
				return Promise.resolve()
			}
		)
		form.doc.value!.title = 'Summer batch'
		expect(await form.submitBatch()).toBe(true)
	})

	it('resolves false when the save fails', async () => {
		const form = await mountForm()
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
		state.resource.setValue.submit.mockImplementationOnce(
			(_values: unknown, options: { onError: (error: unknown) => void }) => {
				options.onError({ messages: ['Conflict'] })
				return Promise.resolve()
			}
		)
		form.doc.value!.title = 'Summer batch'
		expect(await form.submitBatch()).toBe(false)
		logged.mockRestore()
	})

	it('saves changed meta tags through the shared helper, which reports failures', async () => {
		const form = await mountForm()
		state.resource.setValue.submit.mockImplementationOnce(
			(_values: unknown, options: { onSuccess: (doc: unknown) => void }) => {
				options.onSuccess({ name: 'B1' })
				return Promise.resolve()
			}
		)
		form.meta.description = 'A spring batch'
		await form.submitBatch()
		expect(updateMetaInfo).toHaveBeenCalledWith('batches', 'B1', form.meta)
	})

	it('has nothing to send when nothing changed', async () => {
		const form = await mountForm()
		expect(await form.submitBatch()).toBe(true)
		expect(state.resource.setValue.submit).not.toHaveBeenCalled()
	})
})

describe('missing batch fields', () => {
	it('names the empty required fields', () => {
		const missing = missingBatchFields({
			doc: { ...completeDoc(), title: '', batch_details: '<p></p>' },
			instructors: [],
		})
		expect(missing.map((field) => field.key)).toEqual([
			'title',
			'instructors',
			'batch_details',
		])
	})

	it('asks for a price and currency only on a paid batch', () => {
		const doc = { ...completeDoc(), paid_batch: 1 as const, amount: 0 }
		const keys = missingBatchFields({ doc, instructors: ['a'] }).map(
			(field) => field.key
		)
		expect(keys).toEqual(['currency', 'amount'])
	})
})
