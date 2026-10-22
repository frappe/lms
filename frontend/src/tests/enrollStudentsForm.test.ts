import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import type {
	EnrollPreview,
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
} from '@/types'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

const { createResourceMock, toastErrorMock } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { createResourceMock: vi.fn(), toastErrorMock: vi.fn() }
})

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	toast: { success: vi.fn(), error: toastErrorMock },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size', 'position'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot /><slot name="actions" /></div>`,
	},
}))

vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		props: ['label', 'variant', 'loading', 'disabled'],
		emits: ['click'],
		template: `<button v-bind="$attrs" :disabled="disabled" :data-variant="variant" @click="$emit('click')">{{ label }}</button>`,
	},
}))

vi.mock('@/components/Stepper', () => ({
	Stepper: {
		name: 'Stepper',
		props: ['steps', 'modelValue', 'completed', 'clickable'],
		emits: ['update:modelValue'],
		template: `<ol data-testid="stepper" />`,
	},
}))

vi.mock('@/components/Enrollment/EnrollSelectStep.vue', () => ({
	default: {
		name: 'EnrollSelectStep',
		props: ['target', 'members', 'paid'],
		emits: ['update:members', 'update:paid'],
		template: `<div data-testid="select-step" />`,
	},
}))

vi.mock('@/components/Enrollment/EnrollReviewStep.vue', () => ({
	default: {
		name: 'EnrollReviewStep',
		props: ['rows', 'seatsLeft', 'loading'],
		emits: ['remove'],
		template: `<div data-testid="review-step" />`,
	},
}))

vi.mock('@/components/Enrollment/EnrollPaymentStep.vue', () => ({
	default: {
		name: 'EnrollPaymentStep',
		props: ['rows', 'defaults', 'choices'],
		emits: ['update:defaults', 'update:choices'],
		template: `<div data-testid="payment-step" />`,
	},
}))

vi.mock('@/components/Enrollment/EnrollSummary.vue', () => ({
	default: {
		name: 'EnrollSummary',
		props: ['result', 'skipped'],
		template: `<div data-testid="summary" />`,
	},
}))

import EnrollStudentsForm from '@/components/Enrollment/EnrollStudentsForm.vue'

const PREVIEW = 'lms.lms.api.get_bulk_enrollment_preview'
const COURSE = 'lms.lms.api.enroll_students_in_course'
const BATCH = 'lms.lms.api.add_students_to_batch'

type FakeResource = { loading: boolean; submit: ReturnType<typeof vi.fn> }
const resources: Record<string, FakeResource> = {
	[PREVIEW]: reactive({ loading: false, submit: vi.fn() }),
	[COURSE]: reactive({ loading: false, submit: vi.fn() }),
	[BATCH]: reactive({ loading: false, submit: vi.fn() }),
}
createResourceMock.mockImplementation(
	(options: { url: string }) => resources[options.url]
)

type Handlers = {
	onSuccess?: (data: unknown) => void
	onError?: (error: unknown) => void
}

const respond = (url: string, data: unknown) => {
	resources[url].submit.mockImplementation(
		async (_params: unknown, options: Handlers) => {
			options.onSuccess?.(data)
			return data
		}
	)
}

const paramsOf = (url: string, call = -1): Record<string, unknown> =>
	resources[url].submit.mock.calls.at(call)?.[0] as Record<string, unknown>

const courseTarget: EnrollTarget = {
	doctype: 'LMS Course',
	name: 'C1',
	paidKind: null,
	priceLabel: null,
}

const row = (member: string, status: EnrollStatus): EnrollPreviewRow => ({
	member,
	full_name: member,
	user_image: null,
	status,
	linkable_payments: [],
})

const preview = (
	rows: EnrollPreviewRow[],
	seats_left: number | null = null
): EnrollPreview => ({ rows, seats_left, amount: 100, currency: 'INR' })

const mountForm = (
	props: Partial<{
		target: EnrollTarget | null
		refusal: string
		loading: boolean
	}> = {},
	attach = false
) =>
	mount(EnrollStudentsForm, {
		props: { target: courseTarget, refusal: '', loading: false, ...props },
		global: { stubs: { teleport: true }, mocks: { __: translate } },
		...(attach ? { attachTo: document.body } : {}),
	})

const setWidth = (value: number) => {
	Object.defineProperty(window, 'innerWidth', {
		value,
		writable: true,
		configurable: true,
	})
}

type Wrapper = VueWrapper<InstanceType<typeof EnrollStudentsForm>>

const button = (wrapper: Wrapper, id: string) =>
	wrapper.find(`[data-testid="${id}"]`)

const click = async (wrapper: Wrapper, id: string) => {
	await button(wrapper, id).trigger('click')
	await flushPromises()
}

const step = (wrapper: Wrapper, name: string) => wrapper.findComponent({ name })

const select = async (wrapper: Wrapper, members: string[]) => {
	step(wrapper, 'EnrollSelectStep').vm.$emit('update:members', members)
	await flushPromises()
}

const toReview = async (
	wrapper: Wrapper,
	members: string[],
	data: EnrollPreview
) => {
	respond(PREVIEW, data)
	await select(wrapper, members)
	await click(wrapper, 'enroll-next')
}

const stepValues = (wrapper: Wrapper) =>
	(step(wrapper, 'Stepper').props('steps') as { value: string }[]).map(
		(item) => item.value
	)

describe('EnrollStudentsForm', () => {
	beforeEach(() => {
		for (const resource of Object.values(resources)) {
			resource.submit.mockReset()
			resource.loading = false
		}
		createResourceMock.mockClear()
		toastErrorMock.mockReset()
		setWidth(1024)
	})

	it('shows the refusal instead of the steps', () => {
		const wrapper = mountForm({ refusal: 'You may not enroll students.' })

		expect(wrapper.text()).toContain('You may not enroll students.')
		expect(wrapper.find('[data-testid="stepper"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="select-step"]').exists()).toBe(false)
		expect(button(wrapper, 'enroll-next').exists()).toBe(false)
	})

	it('fetches the preview for the selected members on Next', async () => {
		const wrapper = mountForm()
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'ready')])
		)

		expect(resources[PREVIEW].submit).toHaveBeenCalledTimes(1)
		expect(paramsOf(PREVIEW)).toEqual({
			doctype: 'LMS Course',
			docname: 'C1',
			members: JSON.stringify(['a@x.com', 'b@x.com']),
			purchased_certificate: false,
		})
		expect(step(wrapper, 'EnrollReviewStep').props('rows')).toHaveLength(2)
	})

	it('submits only enrollable rows to the course endpoint', async () => {
		const wrapper = mountForm()
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com', 'c@x.com'],
			preview([
				row('a@x.com', 'ready'),
				row('b@x.com', 'enrolled'),
				row('c@x.com', 'no_user'),
			])
		)

		expect(button(wrapper, 'enroll-submit').text()).toBe('Enroll 1 student')
		await click(wrapper, 'enroll-submit')

		expect(resources[COURSE].submit).toHaveBeenCalledTimes(1)
		expect(paramsOf(COURSE)).toEqual({
			course: 'C1',
			members: JSON.stringify(['a@x.com']),
			purchased_certificate: false,
		})
	})

	it('posts to add_students_to_batch for a batch target', async () => {
		const wrapper = mountForm({
			target: { ...courseTarget, doctype: 'LMS Batch', name: 'B1' },
		})
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')], 5))
		await click(wrapper, 'enroll-submit')

		expect(resources[COURSE].submit).not.toHaveBeenCalled()
		expect(paramsOf(BATCH)).toEqual({
			batch: 'B1',
			members: JSON.stringify(['a@x.com']),
		})
	})

	it('removing a row in review drops it from the picker and the submit', async () => {
		const wrapper = mountForm()
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'ready')])
		)

		step(wrapper, 'EnrollReviewStep').vm.$emit('remove', 'b@x.com')
		await flushPromises()
		expect(
			(
				step(wrapper, 'EnrollReviewStep').props('rows') as EnrollPreviewRow[]
			).map((item) => item.member)
		).toEqual(['a@x.com'])
		expect(resources[PREVIEW].submit).toHaveBeenCalledTimes(1)

		await click(wrapper, 'enroll-back')
		expect(step(wrapper, 'EnrollSelectStep').props('members')).toEqual([
			'a@x.com',
		])

		respond(PREVIEW, preview([row('a@x.com', 'ready')]))
		await click(wrapper, 'enroll-next')
		expect(paramsOf(PREVIEW).members).toBe(JSON.stringify(['a@x.com']))

		await click(wrapper, 'enroll-submit')
		expect(paramsOf(COURSE).members).toBe(JSON.stringify(['a@x.com']))
	})

	it('adds a Payments step only while the paid switch is on', async () => {
		const wrapper = mountForm({
			target: { ...courseTarget, paidKind: 'course', priceLabel: '₹100' },
		})
		expect(stepValues(wrapper)).toEqual(['select', 'review'])

		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', true)
		await flushPromises()
		expect(stepValues(wrapper)).toEqual(['select', 'review', 'payments'])

		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', false)
		await flushPromises()
		expect(stepValues(wrapper)).toEqual(['select', 'review'])
	})

	it('turning the paid switch off sends no payment arguments', async () => {
		const wrapper = mountForm({
			target: { ...courseTarget, paidKind: 'course', priceLabel: '₹100' },
		})
		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', true)
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))
		expect(paramsOf(PREVIEW).purchased_certificate).toBe(false)

		await click(wrapper, 'enroll-next')
		const payments = step(wrapper, 'EnrollPaymentStep')
		expect(payments.props('defaults')).toEqual({
			amount: 100,
			currency: 'INR',
			source: null,
		})
		expect(payments.props('choices')).toEqual({ 'a@x.com': { mode: 'create' } })
		payments.vm.$emit('update:defaults', {
			amount: 100,
			currency: 'INR',
			source: 'Web',
		})
		await flushPromises()
		expect(button(wrapper, 'enroll-submit').attributes('disabled')).toBe(
			undefined
		)

		await click(wrapper, 'enroll-back')
		await click(wrapper, 'enroll-back')
		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', false)
		await flushPromises()
		await click(wrapper, 'enroll-next')
		await click(wrapper, 'enroll-submit')

		const params = paramsOf(COURSE)
		expect(params).not.toHaveProperty('payment_details')
		expect(params).not.toHaveProperty('linked_payments')
		expect(params.members).toBe(JSON.stringify(['a@x.com']))
	})

	it('disables Next in review while seats are exceeded', async () => {
		const wrapper = mountForm({
			target: {
				doctype: 'LMS Batch',
				name: 'B1',
				paidKind: 'batch',
				priceLabel: '₹100',
			},
		})
		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', true)
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'ready')], 1)
		)

		expect(button(wrapper, 'enroll-next').text()).toBe('Next')
		expect(button(wrapper, 'enroll-next').attributes('disabled')).toBeDefined()
		expect(step(wrapper, 'EnrollReviewStep').props('seatsLeft')).toBe(1)
	})

	it('shows the summary and emits enrolled once, then Done closes', async () => {
		const wrapper = mountForm()
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'enrolled')])
		)
		respond(COURSE, { added: ['a@x.com'], errors: [] })
		await click(wrapper, 'enroll-submit')

		const result = { added: ['a@x.com'], upgraded: [], errors: [] }
		expect(wrapper.emitted('enrolled')).toEqual([[result]])
		const summary = step(wrapper, 'EnrollSummary')
		expect(summary.props('result')).toEqual(result)
		expect(summary.props('skipped')).toEqual([
			{ member: 'b@x.com', error: 'Already enrolled (will be skipped)' },
		])
		expect(step(wrapper, 'Stepper').props('completed')).toBe(true)

		await click(wrapper, 'enroll-done')
		expect(wrapper.emitted('close')).toHaveLength(1)
		expect(wrapper.emitted('enrolled')).toHaveLength(1)
	})

	it('stays on the step and toasts the server message when submit fails', async () => {
		const wrapper = mountForm()
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))
		resources[COURSE].submit.mockImplementation(
			async (_params: unknown, options: Handlers) => {
				options.onError?.({ messages: ['Course is closed.'] })
				throw new Error('failed')
			}
		)
		await click(wrapper, 'enroll-submit')

		expect(toastErrorMock).toHaveBeenCalledWith('Course is closed.')
		expect(wrapper.find('[data-testid="summary"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="review-step"]').exists()).toBe(true)
		expect(wrapper.emitted('enrolled')).toBeUndefined()
	})

	it('shows N selected on the start side of the first step footer', async () => {
		const wrapper = mountForm()
		expect(button(wrapper, 'enroll-next').attributes('disabled')).toBeDefined()

		await select(wrapper, ['a@x.com', 'b@x.com', 'c@x.com'])

		const footer = wrapper.find('[data-testid="enroll-footer"]')
		expect(footer.element.firstElementChild?.textContent?.trim()).toBe(
			'3 selected'
		)
		expect(button(wrapper, 'enroll-next').attributes('disabled')).toBe(
			undefined
		)
	})

	it('moves focus into the new step after Next and after Back', async () => {
		const wrapper = mountForm({}, true)
		await select(wrapper, ['a@x.com'])
		respond(PREVIEW, preview([row('a@x.com', 'ready')]))
		;(button(wrapper, 'enroll-next').element as HTMLElement).focus()
		await click(wrapper, 'enroll-next')
		const content = () =>
			wrapper.find('[data-testid="enroll-step-content"]').element
		expect(document.activeElement).toBe(content())
		expect(content().getAttribute('role')).toBe('group')
		expect(content().getAttribute('aria-label')).toBe('Review')
		;(button(wrapper, 'enroll-back').element as HTMLElement).focus()
		await click(wrapper, 'enroll-back')
		expect(document.activeElement).toBe(content())
		expect(content().getAttribute('aria-label')).toBe('Select')
	})

	it('on mobile, closing from Review goes back a step', async () => {
		setWidth(375)
		const wrapper = mountForm()
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))

		await click(wrapper, 'form-shell-back')

		expect(wrapper.emitted('close')).toBeUndefined()
		expect(step(wrapper, 'EnrollSelectStep').props('members')).toEqual([
			'a@x.com',
		])
	})

	it('on mobile, closing from Select closes', async () => {
		setWidth(375)
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com'])

		await click(wrapper, 'form-shell-back')

		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('on desktop, closing from Review closes', async () => {
		const wrapper = mountForm()
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))

		step(wrapper, 'Dialog').vm.$emit('update:open', false)
		await flushPromises()

		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('locks Back, the Stepper and a second submit while enrolling', async () => {
		const wrapper = mountForm()
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))
		resources[COURSE].submit.mockImplementation(() => {
			resources[COURSE].loading = true
			return new Promise(() => {})
		})

		await click(wrapper, 'enroll-submit')
		await click(wrapper, 'enroll-submit')

		expect(resources[COURSE].submit).toHaveBeenCalledTimes(1)
		expect(button(wrapper, 'enroll-back').attributes('disabled')).toBeDefined()
		const stepper = step(wrapper, 'Stepper')
		expect(stepper.props('clickable')).toBe(false)
		stepper.vm.$emit('update:modelValue', 'select')
		await flushPromises()
		expect(wrapper.find('[data-testid="review-step"]').exists()).toBe(true)
	})
})
