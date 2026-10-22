import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { emptyAddress, emptyOverride } from '@/components/Enrollment/enrollment'
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
		props: [
			'rows',
			'seatsLeft',
			'loading',
			'paid',
			'certificate',
			'paymentLabels',
		],
		emits: ['remove'],
		template: `<div data-testid="review-step" />`,
	},
}))

vi.mock('@/components/Enrollment/EnrollPaymentStep.vue', () => ({
	default: {
		name: 'EnrollPaymentStep',
		props: ['rows', 'defaults', 'choices', 'overrides', 'panelOpen'],
		emits: [
			'update:defaults',
			'update:choices',
			'update:overrides',
			'update:panelOpen',
		],
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

const toNext = async (
	wrapper: Wrapper,
	members: string[],
	data: EnrollPreview
) => {
	respond(PREVIEW, data)
	await select(wrapper, members)
	await click(wrapper, 'enroll-next')
}

const paidCourse: EnrollTarget = {
	...courseTarget,
	paidKind: 'course',
	priceLabel: '₹100',
}

const setSource = async (wrapper: Wrapper, source: string) => {
	step(wrapper, 'EnrollPaymentStep').vm.$emit('update:defaults', {
		amount: 100,
		currency: 'INR',
		source,
		address: emptyAddress(),
	})
	await flushPromises()
}

const toReview = async (
	wrapper: Wrapper,
	members: string[],
	data: EnrollPreview
) => {
	await toNext(wrapper, members, data)
	await setSource(wrapper, 'Web')
	await click(wrapper, 'enroll-next')
}

const stepper = (wrapper: Wrapper) => wrapper.find('[data-testid="stepper"]')

const bodyClass = (wrapper: Wrapper) =>
	wrapper.get('[data-testid="enroll-body"]').attributes('class')

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
		const wrapper = mountForm({ target: paidCourse })
		await toNext(
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
		expect(step(wrapper, 'EnrollPaymentStep').props('rows')).toHaveLength(2)
	})

	it('submits only enrollable rows to the course endpoint', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com', 'c@x.com'],
			preview([
				row('a@x.com', 'ready'),
				row('b@x.com', 'enrolled'),
				row('c@x.com', 'no_user'),
			])
		)

		const review = step(wrapper, 'EnrollReviewStep')
		expect(
			(review.props('rows') as EnrollPreviewRow[]).map((item) => item.member)
		).toEqual(['a@x.com'])
		expect(review.props('certificate')).toBe(false)
		expect(button(wrapper, 'enroll-submit').text()).toBe('Enroll 1 student')
		await click(wrapper, 'enroll-submit')

		expect(resources[COURSE].submit).toHaveBeenCalledTimes(1)
		expect(paramsOf(COURSE)).toMatchObject({
			course: 'C1',
			members: JSON.stringify(['a@x.com']),
			purchased_certificate: false,
		})
	})

	it('posts to add_students_to_batch for a batch target', async () => {
		const wrapper = mountForm({
			target: {
				...courseTarget,
				doctype: 'LMS Batch',
				name: 'B1',
				paidKind: 'batch',
				priceLabel: '₹100',
			},
		})
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')], 5))
		await click(wrapper, 'enroll-submit')

		expect(resources[COURSE].submit).not.toHaveBeenCalled()
		expect(paramsOf(BATCH)).toMatchObject({
			batch: 'B1',
			members: JSON.stringify(['a@x.com']),
		})
	})

	it('removing a row in review drops it from the picker and the submit', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'ready')])
		)

		step(wrapper, 'EnrollReviewStep').vm.$emit('remove', ['b@x.com'])
		await flushPromises()
		expect(
			(
				step(wrapper, 'EnrollReviewStep').props('rows') as EnrollPreviewRow[]
			).map((item) => item.member)
		).toEqual(['a@x.com'])
		expect(resources[PREVIEW].submit).toHaveBeenCalledTimes(1)

		await click(wrapper, 'enroll-back')
		await click(wrapper, 'enroll-back')
		expect(step(wrapper, 'EnrollSelectStep').props('members')).toEqual([
			'a@x.com',
		])

		respond(PREVIEW, preview([row('a@x.com', 'ready')]))
		await click(wrapper, 'enroll-next')
		expect(paramsOf(PREVIEW).members).toBe(JSON.stringify(['a@x.com']))

		await click(wrapper, 'enroll-next')
		await click(wrapper, 'enroll-submit')
		expect(paramsOf(COURSE).members).toBe(JSON.stringify(['a@x.com']))
	})

	it('orders the steps Select, Payments, Review with payments on by default', async () => {
		const wrapper = mountForm({ target: paidCourse })
		expect(step(wrapper, 'EnrollSelectStep').props('paid')).toBe(true)
		expect(stepValues(wrapper)).toEqual(['select', 'payments', 'review'])

		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', false)
		await flushPromises()
		expect(stepper(wrapper).exists()).toBe(false)

		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', true)
		await flushPromises()
		expect(stepValues(wrapper)).toEqual(['select', 'payments', 'review'])
	})

	it('renders no stepper and enrolls straight from Select when unpaid', async () => {
		const wrapper = mountForm()
		expect(stepper(wrapper).exists()).toBe(false)
		expect(button(wrapper, 'enroll-next').exists()).toBe(false)
		expect(
			button(wrapper, 'enroll-submit').attributes('disabled')
		).toBeDefined()

		await select(wrapper, ['a@x.com', 'b@x.com'])
		expect(button(wrapper, 'enroll-submit').text()).toBe('Enroll 2 students')
		respond(COURSE, { added: ['a@x.com', 'b@x.com'], errors: [] })
		await click(wrapper, 'enroll-submit')

		expect(resources[PREVIEW].submit).not.toHaveBeenCalled()
		expect(paramsOf(COURSE)).toEqual({
			course: 'C1',
			members: JSON.stringify(['a@x.com', 'b@x.com']),
			purchased_certificate: false,
		})
		expect(wrapper.find('[data-testid="summary"]').exists()).toBe(true)
		expect(stepper(wrapper).exists()).toBe(false)
	})

	it('shows the stepper while paid and drops it when the switch goes off', async () => {
		const wrapper = mountForm({ target: paidCourse })
		expect(stepper(wrapper).exists()).toBe(true)
		expect(button(wrapper, 'enroll-next').exists()).toBe(true)
		expect(button(wrapper, 'enroll-submit').exists()).toBe(false)

		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', false)
		await flushPromises()
		expect(stepper(wrapper).exists()).toBe(false)
		expect(button(wrapper, 'enroll-next').exists()).toBe(false)
		expect(button(wrapper, 'enroll-submit').exists()).toBe(true)
	})

	it('keeps the dialog body class with and without the stepper', async () => {
		const wrapper = mountForm({ target: paidCourse })
		const paidClass = bodyClass(wrapper)
		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', false)
		await flushPromises()
		expect(bodyClass(wrapper)).toBe(paidClass)
		expect(step(wrapper, 'Dialog').props('size')).toBe('4xl')
	})

	it('does not scroll the step container on Select, so only the list scrolls', async () => {
		const wrapper = mountForm()
		const content = wrapper.get('[data-testid="enroll-step-content"]')
		expect(content.classes()).toContain('overflow-hidden')
		expect(content.classes()).not.toContain('overflow-y-auto')

		await select(wrapper, ['a@x.com'])
		respond(COURSE, { added: ['a@x.com'], errors: [] })
		await click(wrapper, 'enroll-submit')
		const after = wrapper.get('[data-testid="enroll-step-content"]')
		expect(after.classes()).toContain('overflow-y-auto')
	})

	it('turns payments on by default for a paid batch', () => {
		const wrapper = mountForm({
			target: {
				doctype: 'LMS Batch',
				name: 'B1',
				paidKind: 'batch',
				priceLabel: null,
			},
		})
		expect(step(wrapper, 'EnrollSelectStep').props('paid')).toBe(true)
	})

	it('leaves the paid certificate off by default', () => {
		const wrapper = mountForm({
			target: { ...courseTarget, paidKind: 'certificate', priceLabel: '₹9' },
		})
		expect(step(wrapper, 'EnrollSelectStep').props('paid')).toBe(false)
		expect(stepper(wrapper).exists()).toBe(false)
	})

	it('turns payments on once a target that loads late turns out paid', async () => {
		const wrapper = mountForm({ target: null, loading: true })
		await wrapper.setProps({ target: paidCourse, loading: false })
		expect(step(wrapper, 'EnrollSelectStep').props('paid')).toBe(true)
	})

	it('fetches the preview when leaving Select, then shows Payments before Review', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toNext(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))
		expect(resources[PREVIEW].submit).toHaveBeenCalledTimes(1)
		const payments = step(wrapper, 'EnrollPaymentStep')
		expect(payments.props('rows')).toHaveLength(1)
		expect(payments.props('defaults')).toEqual({
			amount: 100,
			currency: 'INR',
			source: null,
			address: emptyAddress(),
		})
		expect(payments.props('choices')).toEqual({ 'a@x.com': { mode: 'create' } })
		expect(
			button(wrapper, 'enroll-next').attributes('disabled')
		).toBeUndefined()

		await setSource(wrapper, 'Web')
		await click(wrapper, 'enroll-next')
		const review = step(wrapper, 'EnrollReviewStep')
		expect(review.props('paid')).toBe(true)
		expect(review.props('paymentLabels')['a@x.com']).toMatch(
			/^New · .*100.* · Web$/
		)
		expect(button(wrapper, 'enroll-submit').attributes('disabled')).toBe(
			undefined
		)
		await click(wrapper, 'enroll-back')
		expect(wrapper.find('[data-testid="payment-step"]').exists()).toBe(true)
	})

	it('lists only ready or upgrade rows on Payments and Review', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toNext(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'enrolled')])
		)
		expect(
			(
				step(wrapper, 'EnrollPaymentStep').props('rows') as EnrollPreviewRow[]
			).map((item) => item.member)
		).toEqual(['a@x.com'])
	})

	it('stays on Select while the preview loads and when it fails', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await select(wrapper, ['a@x.com'])
		resources[PREVIEW].submit.mockImplementation(
			async (_params: unknown, options: Handlers) => {
				options.onError?.({ messages: ['Nope.'] })
				throw new Error('failed')
			}
		)
		await click(wrapper, 'enroll-next')
		expect(toastErrorMock).toHaveBeenCalledWith('Nope.')
		expect(wrapper.find('[data-testid="select-step"]').exists()).toBe(true)

		resources[PREVIEW].submit.mockImplementation(() => {
			resources[PREVIEW].loading = true
			return new Promise(() => {})
		})
		await click(wrapper, 'enroll-next')
		expect(wrapper.find('[data-testid="select-step"]').exists()).toBe(true)
		expect(button(wrapper, 'enroll-next').attributes('disabled')).toBeDefined()
	})

	it('sends per-student overrides with the common payment details', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toNext(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'ready')])
		)
		await setSource(wrapper, 'Web')
		step(wrapper, 'EnrollPaymentStep').vm.$emit('update:overrides', {
			'b@x.com': { ...emptyOverride(), amount: 40 },
		})
		await flushPromises()
		await click(wrapper, 'enroll-next')
		await click(wrapper, 'enroll-submit')
		const params = paramsOf(COURSE)
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
			source: 'Web',
		})
		expect(JSON.parse(params.member_payment_details as string)).toEqual({
			'b@x.com': { amount: 40 },
		})
	})

	it('turning the paid switch off sends no payment arguments', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toNext(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))
		await setSource(wrapper, 'Web')
		await click(wrapper, 'enroll-back')
		step(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', false)
		await flushPromises()
		resources[PREVIEW].submit.mockClear()
		await click(wrapper, 'enroll-submit')

		expect(resources[PREVIEW].submit).not.toHaveBeenCalled()
		const params = paramsOf(COURSE)
		expect(params).not.toHaveProperty('payment_details')
		expect(params).not.toHaveProperty('member_payment_details')
		expect(params).not.toHaveProperty('linked_payments')
		expect(params.members).toBe(JSON.stringify(['a@x.com']))
	})

	it('disables Enroll in review while seats are exceeded', async () => {
		const wrapper = mountForm({
			target: {
				doctype: 'LMS Batch',
				name: 'B1',
				paidKind: 'batch',
				priceLabel: '₹100',
			},
		})
		await toNext(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'ready')], 1)
		)
		await setSource(wrapper, 'Web')
		await click(wrapper, 'enroll-next')

		expect(
			button(wrapper, 'enroll-submit').attributes('disabled')
		).toBeDefined()
		expect(step(wrapper, 'EnrollReviewStep').props('seatsLeft')).toBe(1)
	})

	it('keeps one dialog size on every step and the summary', async () => {
		const wrapper = mountForm({ target: paidCourse })
		expect(step(wrapper, 'Dialog').props('size')).toBe('4xl')
		const sizes = [bodyClass(wrapper)]
		await toNext(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))
		expect(wrapper.find('[data-testid="payment-step"]').exists()).toBe(true)
		sizes.push(bodyClass(wrapper))
		await setSource(wrapper, 'Web')
		await click(wrapper, 'enroll-next')
		expect(wrapper.find('[data-testid="review-step"]').exists()).toBe(true)
		sizes.push(bodyClass(wrapper))
		respond(COURSE, { added: ['a@x.com'], errors: [] })
		await click(wrapper, 'enroll-submit')
		expect(wrapper.find('[data-testid="summary"]').exists()).toBe(true)
		sizes.push(bodyClass(wrapper))

		expect(sizes[0]).toMatch(/(^| )h-\[/)
		expect(new Set(sizes).size).toBe(1)
	})

	it('shows the summary and emits enrolled once, then Done closes', async () => {
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com', 'b@x.com'])
		const errors = [{ member: 'b@x.com', error: 'Already enrolled' }]
		respond(COURSE, { added: ['a@x.com'], errors })
		await click(wrapper, 'enroll-submit')

		const result = { added: ['a@x.com'], upgraded: [], errors }
		expect(wrapper.emitted('enrolled')).toEqual([[result]])
		const summary = step(wrapper, 'EnrollSummary')
		expect(summary.props('result')).toEqual(result)
		expect(summary.props('skipped')).toEqual([])
		expect(stepper(wrapper).exists()).toBe(false)

		await click(wrapper, 'enroll-done')
		expect(wrapper.emitted('close')).toHaveLength(1)
		expect(wrapper.emitted('enrolled')).toHaveLength(1)
	})

	it('lists preview-skipped rows in the paid summary', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toReview(
			wrapper,
			['a@x.com', 'b@x.com'],
			preview([row('a@x.com', 'ready'), row('b@x.com', 'enrolled')])
		)
		respond(COURSE, { added: ['a@x.com'], errors: [] })
		await click(wrapper, 'enroll-submit')

		expect(step(wrapper, 'EnrollSummary').props('skipped')).toEqual([
			{ member: 'b@x.com', error: 'Already enrolled (will be skipped)' },
		])
		expect(step(wrapper, 'Stepper').props('completed')).toBe(true)
	})

	it('stays on Select and toasts the server message when submit fails', async () => {
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com'])
		resources[COURSE].submit.mockImplementation(
			async (_params: unknown, options: Handlers) => {
				options.onError?.({ messages: ['Course is closed.'] })
				throw new Error('failed')
			}
		)
		await click(wrapper, 'enroll-submit')

		expect(toastErrorMock).toHaveBeenCalledWith('Course is closed.')
		expect(wrapper.find('[data-testid="summary"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="select-step"]').exists()).toBe(true)
		expect(wrapper.emitted('enrolled')).toBeUndefined()
	})

	it('shows N selected on the start side of the first step footer', async () => {
		const wrapper = mountForm({ target: paidCourse })
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
		const wrapper = mountForm({ target: paidCourse }, true)
		await select(wrapper, ['a@x.com'])
		respond(PREVIEW, preview([row('a@x.com', 'ready')]))
		;(button(wrapper, 'enroll-next').element as HTMLElement).focus()
		await click(wrapper, 'enroll-next')
		const content = () =>
			wrapper.find('[data-testid="enroll-step-content"]').element
		expect(document.activeElement).toBe(content())
		expect(content().getAttribute('role')).toBe('group')
		expect(content().getAttribute('aria-label')).toBe('Payments')
		;(button(wrapper, 'enroll-back').element as HTMLElement).focus()
		await click(wrapper, 'enroll-back')
		expect(document.activeElement).toBe(content())
		expect(content().getAttribute('aria-label')).toBe('Select')
	})

	it('on mobile, closing from Review goes back a step', async () => {
		setWidth(375)
		const wrapper = mountForm({ target: paidCourse })
		await toReview(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))

		await click(wrapper, 'form-shell-back')
		expect(wrapper.find('[data-testid="payment-step"]').exists()).toBe(true)
		await click(wrapper, 'form-shell-back')

		expect(wrapper.emitted('close')).toBeUndefined()
		expect(step(wrapper, 'EnrollSelectStep').props('members')).toEqual([
			'a@x.com',
		])
	})

	it('on mobile, back from a student panel returns to the Payments list first', async () => {
		setWidth(375)
		const wrapper = mountForm({ target: paidCourse })
		await toNext(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))
		step(wrapper, 'EnrollPaymentStep').vm.$emit('update:panelOpen', true)
		await flushPromises()

		await click(wrapper, 'form-shell-back')
		const payments = step(wrapper, 'EnrollPaymentStep')
		expect(payments.exists()).toBe(true)
		expect(payments.props('panelOpen')).toBe(false)

		await click(wrapper, 'form-shell-back')
		expect(wrapper.find('[data-testid="select-step"]').exists()).toBe(true)
		expect(wrapper.emitted('close')).toBeUndefined()
	})

	it('falls back to Create new when a linked payment is no longer offered', async () => {
		const linkable = (name: string) => ({
			...row('a@x.com', 'ready'),
			linkable_payments: [
				{ name, amount: 100, currency: 'INR', creation: '2026-01-01' },
			],
		})
		const wrapper = mountForm({ target: paidCourse })
		await toNext(wrapper, ['a@x.com', 'b@x.com'], {
			...preview([linkable('P1'), row('b@x.com', 'ready')]),
		})
		step(wrapper, 'EnrollPaymentStep').vm.$emit('update:choices', {
			'a@x.com': { mode: 'link', payment: 'P1' },
			'b@x.com': { mode: 'link', payment: null },
		})
		await flushPromises()
		await click(wrapper, 'enroll-back')
		respond(PREVIEW, preview([linkable('P2'), row('b@x.com', 'ready')]))
		await click(wrapper, 'enroll-next')
		expect(step(wrapper, 'EnrollPaymentStep').props('choices')).toEqual({
			'a@x.com': { mode: 'create' },
			'b@x.com': { mode: 'create' },
		})
	})

	it('keeps a link choice whose payment is still offered', async () => {
		const linked = {
			...row('a@x.com', 'ready'),
			linkable_payments: [
				{ name: 'P1', amount: 100, currency: 'INR', creation: '2026-01-01' },
			],
		}
		const wrapper = mountForm({ target: paidCourse })
		await toNext(wrapper, ['a@x.com'], preview([linked]))
		step(wrapper, 'EnrollPaymentStep').vm.$emit('update:choices', {
			'a@x.com': { mode: 'link', payment: 'P1' },
		})
		await flushPromises()
		await click(wrapper, 'enroll-back')
		await click(wrapper, 'enroll-next')
		expect(step(wrapper, 'EnrollPaymentStep').props('choices')).toEqual({
			'a@x.com': { mode: 'link', payment: 'P1' },
		})
	})

	it('on mobile, the header action reads Enroll N students when unpaid', async () => {
		setWidth(375)
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com', 'b@x.com'])

		const header = wrapper.get('[data-testid="form-shell-header-actions"]')
		expect(header.get('[data-testid="enroll-submit"]').text()).toBe(
			'Enroll 2 students'
		)
		expect(stepper(wrapper).exists()).toBe(false)
	})

	it('on mobile, closing from Select closes', async () => {
		setWidth(375)
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com'])

		await click(wrapper, 'form-shell-back')

		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('on desktop, closing from Review closes', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await toNext(wrapper, ['a@x.com'], preview([row('a@x.com', 'ready')]))

		step(wrapper, 'Dialog').vm.$emit('update:open', false)
		await flushPromises()

		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('locks Back, the Stepper and a second submit while enrolling', async () => {
		const wrapper = mountForm({ target: paidCourse })
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
