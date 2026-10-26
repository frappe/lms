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
	PaymentDefaults,
	StudentRow,
} from '@/types'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

const focusFirstMock = vi.hoisted(() => vi.fn())
const { createResourceMock, toastErrorMock, toastMock } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createResourceMock: vi.fn(),
		toastErrorMock: vi.fn(),
		toastMock: { success: vi.fn(), warning: vi.fn() },
	}
})

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	toast: { ...toastMock, error: toastErrorMock },
	ErrorMessage: {
		props: ['message'],
		template: `<div data-testid="error">{{ message }}</div>`,
	},
	Tooltip: {
		name: 'Tooltip',
		props: ['text'],
		template: `<slot />`,
	},
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

vi.mock('@/components/Enrollment/EnrollSelectStep.vue', () => ({
	default: {
		name: 'EnrollSelectStep',
		props: ['target', 'members', 'paid', 'checking'],
		emits: ['update:members', 'update:paid', 'update:checking'],
		template: `<div data-testid="select-step"><slot name="list" :students="members.map((m) => ({ value: m, label: 'Picked ' + m, description: m, image: null }))" :remove="(gone) => $emit('update:members', members.filter((x) => !gone.includes(x)))" /></div>`,
	},
}))

vi.mock('@/components/Enrollment/EnrollStudentTable.vue', () => ({
	default: {
		name: 'EnrollStudentTable',
		props: ['rows', 'paid', 'compact', 'ticked'],
		emits: ['update:ticked', 'remove', 'reset'],
		template: `<div data-testid="student-table" />`,
	},
}))

vi.mock('@/components/Enrollment/EnrollPaymentPanel.vue', () => ({
	default: {
		name: 'EnrollPaymentPanel',
		props: [
			'rows',
			'common',
			'commonAddressUsed',
			'total',
			'showBack',
			'flagMissing',
			'defaults',
			'choices',
			'overrides',
		],
		methods: {
			focusFirst() {
				focusFirstMock()
			},
		},
		emits: [
			'update:defaults',
			'update:choices',
			'update:overrides',
			'close',
			'back',
		],
		template: `<div data-testid="panel-stub" />`,
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

const paidCourse: EnrollTarget = {
	...courseTarget,
	paidKind: 'course',
	priceLabel: '₹100',
}

const paidBatch: EnrollTarget = {
	doctype: 'LMS Batch',
	name: 'B1',
	paidKind: 'batch',
	priceLabel: '₹100',
}

const row = (
	member: string,
	status: EnrollStatus = 'ready',
	extra: Partial<EnrollPreviewRow> = {}
): EnrollPreviewRow => ({
	member,
	full_name: `Name ${member}`,
	user_image: null,
	status,
	linkable_payments: [],
	...extra,
})

const preview = (
	rows: EnrollPreviewRow[],
	extra: Partial<EnrollPreview> = {}
): EnrollPreview => ({
	rows,
	seats_left: null,
	amount: 100,
	currency: 'INR',
	...extra,
})

const mountForm = (
	props: Partial<{
		target: EnrollTarget | null
		refusal: string
		loading: boolean
	}> = {}
) =>
	mount(EnrollStudentsForm, {
		props: { target: courseTarget, refusal: '', loading: false, ...props },
		global: { stubs: { teleport: true }, mocks: { __: translate } },
	})

const setWidth = (value: number) => {
	Object.defineProperty(window, 'innerWidth', {
		value,
		writable: true,
		configurable: true,
	})
}

type Wrapper = VueWrapper<InstanceType<typeof EnrollStudentsForm>>

const byId = (wrapper: Wrapper, id: string) =>
	wrapper.find(`[data-testid="${id}"]`)

const click = async (wrapper: Wrapper, id: string) => {
	await byId(wrapper, id).trigger('click')
	await flushPromises()
}

const part = (wrapper: Wrapper, name: string) => wrapper.findComponent({ name })

const select = async (wrapper: Wrapper, members: string[]) => {
	part(wrapper, 'EnrollSelectStep').vm.$emit('update:members', members)
	await flushPromises()
}

const selectPaid = async (
	wrapper: Wrapper,
	members: string[],
	data: EnrollPreview
) => {
	respond(PREVIEW, data)
	await select(wrapper, members)
}

const tick = async (wrapper: Wrapper, members: string[]) => {
	part(wrapper, 'EnrollStudentTable').vm.$emit('update:ticked', members)
	await flushPromises()
}

const panelEmit = async (wrapper: Wrapper, event: string, value: unknown) => {
	part(wrapper, 'EnrollPaymentPanel').vm.$emit(event, value)
	await flushPromises()
}

const tableRows = (wrapper: Wrapper) =>
	part(wrapper, 'EnrollStudentTable').props('rows') as StudentRow[]

const panelMembers = (wrapper: Wrapper) =>
	(part(wrapper, 'EnrollPaymentPanel').props('rows') as EnrollPreviewRow[]).map(
		(item) => item.member
	)

const editsCommon = (wrapper: Wrapper) =>
	part(wrapper, 'EnrollPaymentPanel').props('common') as boolean

const status = (wrapper: Wrapper) =>
	wrapper.get('[data-testid="enroll-status"]').text()

const bodyClass = (wrapper: Wrapper) =>
	wrapper.get('[data-testid="enroll-body"]').attributes('class')

const submitParams = async (wrapper: Wrapper) => {
	respond(COURSE, { added: [], errors: [] })
	await click(wrapper, 'enroll-submit')
	return paramsOf(COURSE)
}

const openForAll = (wrapper: Wrapper) => click(wrapper, 'enroll-details')

const SAVED = { name: 'ADDR-1', summary: 'Pune' }

const addressForAll = async (wrapper: Wrapper) => {
	await openForAll(wrapper)
	const current = part(wrapper, 'EnrollPaymentPanel').props(
		'defaults'
	) as PaymentDefaults
	await panelEmit(wrapper, 'update:defaults', { ...current, address: SAVED })
	await panelEmit(wrapper, 'close', undefined)
	await tick(wrapper, [])
}

const AB = ['a@x.com', 'b@x.com']
const ABPreview = () => preview(AB.map((member) => row(member)))

describe('EnrollStudentsForm', () => {
	beforeEach(() => {
		for (const resource of Object.values(resources)) {
			resource.submit.mockReset()
			resource.loading = false
		}
		createResourceMock.mockClear()
		toastErrorMock.mockReset()
		toastMock.success.mockReset()
		toastMock.warning.mockReset()
		setWidth(1024)
	})

	it('shows the refusal instead of the form', () => {
		const wrapper = mountForm({ refusal: 'You may not enroll students.' })

		expect(wrapper.text()).toContain('You may not enroll students.')
		expect(byId(wrapper, 'select-step').exists()).toBe(false)
		expect(byId(wrapper, 'enroll-submit').exists()).toBe(false)
	})

	it('free flow lists students without a panel and enrolls directly', async () => {
		const wrapper = mountForm()
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()
		await select(wrapper, AB)

		expect(part(wrapper, 'EnrollStudentTable').props('paid')).toBe(false)
		expect(tableRows(wrapper).map((item) => item.name)).toEqual([
			'Picked a@x.com',
			'Picked b@x.com',
		])
		expect(status(wrapper)).toBe('2 students')
		expect(byId(wrapper, 'enroll-details').exists()).toBe(false)
		expect(byId(wrapper, 'enroll-submit').text()).toBe('Enroll 2 students')
		await tick(wrapper, ['a@x.com'])
		expect(byId(wrapper, 'enroll-details').exists()).toBe(false)
		expect(byId(wrapper, 'payment-panel').exists()).toBe(false)

		respond(COURSE, { added: AB, errors: [] })
		await click(wrapper, 'enroll-submit')
		expect(resources[PREVIEW].submit).not.toHaveBeenCalled()
		expect(paramsOf(COURSE)).toEqual({
			course: 'C1',
			members: JSON.stringify(AB),
			purchased_certificate: false,
		})
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('turns payments on for a paid course and previews each new selection', async () => {
		const wrapper = mountForm({ target: paidCourse })
		expect(part(wrapper, 'EnrollSelectStep').props('paid')).toBe(true)
		await selectPaid(wrapper, AB, ABPreview())

		expect(paramsOf(PREVIEW)).toEqual({
			doctype: 'LMS Course',
			docname: 'C1',
			members: JSON.stringify(AB),
			purchased_certificate: false,
		})
		expect(part(wrapper, 'EnrollStudentTable').props('paid')).toBe(true)
		const [first] = tableRows(wrapper)
		expect(first.name).toBe('Name a@x.com')
		expect(first.payment).toMatch(/100[^·]*$/)
		expect(first.billing).toBe('—')
		expect(first.needsAddress).toBe(true)

		await select(wrapper, ['a@x.com'])
		expect(resources[PREVIEW].submit).toHaveBeenCalledTimes(1)
		respond(PREVIEW, preview([row('a@x.com'), row('c@x.com')]))
		await select(wrapper, ['a@x.com', 'c@x.com'])
		expect(resources[PREVIEW].submit).toHaveBeenCalledTimes(2)
	})

	it('turns payments on for a paid batch and off for a paid certificate', async () => {
		expect(
			part(mountForm({ target: paidBatch }), 'EnrollSelectStep').props('paid')
		).toBe(true)
		const certificate = mountForm({
			target: { ...courseTarget, paidKind: 'certificate', priceLabel: '₹9' },
		})
		expect(part(certificate, 'EnrollSelectStep').props('paid')).toBe(false)
		const late = mountForm({ target: null, loading: true })
		await late.setProps({ target: paidCourse, loading: false })
		expect(part(late, 'EnrollSelectStep').props('paid')).toBe(true)
	})

	it('until every student has an address, Enter details for all replaces Enroll', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(
			wrapper,
			AB,
			preview(
				AB.map((m) => row(m)),
				{ currency: null }
			)
		)

		expect(status(wrapper)).toBe('2 students · 200')
		const footer = byId(wrapper, 'enroll-footer')
		expect(footer.findAll('button').map((el) => el.text())).toEqual([
			'Enter details for all',
		])
		const details = byId(wrapper, 'enroll-details')
		expect(details.attributes('data-variant')).toBe('solid')
		expect(details.attributes('disabled')).toBeUndefined()
		expect(byId(wrapper, 'enroll-submit').exists()).toBe(false)
		await click(wrapper, 'enroll-details')

		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual(AB)
		expect(part(wrapper, 'EnrollStudentTable').props('compact')).toBe(true)
		expect(editsCommon(wrapper)).toBe(true)
		expect(part(wrapper, 'EnrollPaymentPanel').props('total')).toBe(2)
		expect(status(wrapper)).toMatch(/^2 students/)
		expect(byId(wrapper, 'enroll-submit').text()).toBe('Enroll 2 students')
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()

		await panelEmit(wrapper, 'update:defaults', {
			amount: 100,
			currency: 'INR',
			source: null,
			address: emptyAddress(),
		})
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()
		await panelEmit(wrapper, 'update:defaults', {
			amount: 100,
			currency: 'INR',
			source: null,
			address: SAVED,
		})
		expect(
			byId(wrapper, 'enroll-submit').attributes('disabled')
		).toBeUndefined()
	})

	it('keeps focus on the footer button when it turns from details into Enroll', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		const button = byId(wrapper, 'enroll-details').element
		await addressForAll(wrapper)
		expect(byId(wrapper, 'enroll-submit').element).toBe(button)
		expect(byId(wrapper, 'enroll-submit').text()).toBe('Enroll 2 students')
	})

	it('Enter details flags the missing fields and focuses the first one', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		focusFirstMock.mockClear()
		await click(wrapper, 'enroll-details')
		expect(part(wrapper, 'EnrollPaymentPanel').props('flagMissing')).toBe(true)
		expect(focusFirstMock).toHaveBeenCalledTimes(1)
	})

	it('says why Enroll is disabled, on hover, on focus and to screen readers', async () => {
		const wrapper = mountForm({ target: paidCourse })
		const reason = () => byId(wrapper, 'enroll-reason').text()
		const primary = () => byId(wrapper, 'enroll-primary')
		await selectPaid(wrapper, AB, ABPreview())
		expect(byId(wrapper, 'enroll-reason').exists()).toBe(false)
		await click(wrapper, 'enroll-details')
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()
		expect(reason()).toBe('Add a billing address for 2 students')
		expect(part(wrapper, 'Tooltip').props('text')).toBe(reason())
		expect(primary().attributes('tabindex')).toBe('0')
		expect(primary().attributes('aria-describedby')).toBe(
			byId(wrapper, 'enroll-reason').attributes('id')
		)

		await panelEmit(wrapper, 'update:overrides', {
			'a@x.com': { ...emptyOverride(), address: SAVED },
		})
		expect(reason()).toBe('Add a billing address for Name b@x.com')
		await panelEmit(wrapper, 'update:overrides', {
			'a@x.com': { ...emptyOverride(), address: SAVED },
			'b@x.com': {
				...emptyOverride(),
				address: { ...emptyAddress(), state: 'MH' },
			},
		})
		expect(reason()).toBe(
			'Fill in Address line 1, City and Country for Name b@x.com'
		)
		await panelEmit(wrapper, 'update:overrides', {
			'a@x.com': { ...emptyOverride(), address: SAVED, amount: -1 },
			'b@x.com': { ...emptyOverride(), address: SAVED },
		})
		expect(reason()).toBe('Fill in Amount for Name a@x.com')
		await panelEmit(wrapper, 'update:overrides', {
			'a@x.com': { ...emptyOverride(), amount: -1 },
		})
		expect(reason()).toBe('Fill in the missing details for 2 students')
		await panelEmit(wrapper, 'update:overrides', {})
		await panelEmit(wrapper, 'update:defaults', {
			amount: null,
			currency: null,
			source: null,
			address: SAVED,
		})
		expect(reason()).toBe('Fill in Amount and Currency in the details for all')
		await panelEmit(wrapper, 'update:defaults', {
			amount: 100,
			currency: 'INR',
			source: null,
			address: SAVED,
		})
		expect(byId(wrapper, 'enroll-reason').exists()).toBe(false)
		expect(primary().attributes('tabindex')).toBeUndefined()
	})

	it('names a link without a payment as the reason', async () => {
		const linkable = row('a@x.com', 'ready', {
			linkable_payments: [
				{ name: 'P1', amount: 100, currency: 'INR', creation: '2026-01-01' },
			],
		})
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, ['a@x.com'], preview([linkable]))
		await click(wrapper, 'enroll-details')
		await panelEmit(wrapper, 'update:choices', {
			'a@x.com': { mode: 'link', payment: null },
		})
		expect(byId(wrapper, 'enroll-reason').text()).toBe(
			'Choose a payment to link for Name a@x.com'
		)
	})

	it('with details complete, puts an outline Enter details for all just before Enroll', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		await addressForAll(wrapper)

		expect(status(wrapper)).toMatch(/^2 students · .*200/)
		const submit = byId(wrapper, 'enroll-submit')
		expect(submit.text()).toBe('Enroll 2 students')
		expect(submit.attributes('disabled')).toBeUndefined()
		expect(submit.attributes('data-variant')).toBe('solid')
		const all = byId(wrapper, 'enroll-details')
		expect(all.text()).toBe('Enter details for all')
		expect(all.attributes('data-variant')).toBe('outline')
		expect(all.element.nextElementSibling).toBe(
			byId(wrapper, 'enroll-primary').element
		)
		expect(
			byId(wrapper, 'enroll-primary').element.contains(submit.element)
		).toBe(true)
		expect(byId(wrapper, 'enroll-reason').exists()).toBe(false)
		expect(
			byId(wrapper, 'enroll-primary').attributes('tabindex')
		).toBeUndefined()
		expect(byId(wrapper, 'enroll-status').element.contains(all.element)).toBe(
			false
		)
		await click(wrapper, 'enroll-details')
		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual(AB)
		expect(byId(wrapper, 'payment-panel').exists()).toBe(true)
		expect(byId(wrapper, 'enroll-details').exists()).toBe(false)
	})

	it('puts the panel beside the list only, below the picker and switch', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		await click(wrapper, 'enroll-details')
		const row = byId(wrapper, 'enroll-list-row')
		const panel = row.get('[data-testid="payment-panel"]')
		expect(
			row.get('[data-testid="enroll-list"]').element.nextElementSibling
		).toBe(panel.element)
		expect(panel.classes()).toContain('border-s')
		expect(byId(wrapper, 'select-step').element.contains(row.element)).toBe(
			true
		)
	})

	// Regression (bulk-enroll PR, feat/bulk-enroll): with everyone ticked the
	// panel edited the common details, hiding one student's different address.
	it('ticking everyone edits them as a group once one has their own details', async () => {
		const wrapper = mountForm({ target: paidCourse })
		const ABC = [...AB, 'c@x.com']
		await selectPaid(wrapper, ABC, preview(ABC.map((m) => row(m))))
		await addressForAll(wrapper)
		await click(wrapper, 'enroll-details')
		await tick(wrapper, ABC)
		expect(editsCommon(wrapper)).toBe(true)

		await panelEmit(wrapper, 'update:overrides', {
			'c@x.com': {
				...emptyOverride(),
				address: { ...emptyAddress(), address_line1: 'dd' },
			},
		})
		expect(editsCommon(wrapper)).toBe(true)
		await tick(wrapper, AB)
		await tick(wrapper, ABC)
		expect(editsCommon(wrapper)).toBe(false)
		expect(panelMembers(wrapper)).toEqual(ABC)
	})

	it('names the ticked rows on the details button, and the panel edits just them', async () => {
		const wrapper = mountForm({ target: paidCourse })
		const ABC = [...AB, 'c@x.com']
		await selectPaid(wrapper, ABC, preview(ABC.map((m) => row(m))))
		await addressForAll(wrapper)

		await tick(wrapper, ['b@x.com'])
		expect(byId(wrapper, 'enroll-details').text()).toBe(
			'Enter details for Name b@x.com'
		)
		expect(byId(wrapper, 'enroll-details').attributes('data-variant')).toBe(
			'outline'
		)
		expect(byId(wrapper, 'enroll-submit').exists()).toBe(true)
		await tick(wrapper, ['a@x.com', 'c@x.com'])
		expect(byId(wrapper, 'enroll-details').text()).toBe(
			'Enter details for 2 students'
		)
		await click(wrapper, 'enroll-details')
		expect(panelMembers(wrapper)).toEqual(['a@x.com', 'c@x.com'])
		expect(editsCommon(wrapper)).toBe(false)

		await tick(wrapper, ['b@x.com'])
		expect(panelMembers(wrapper)).toEqual(['b@x.com'])
		await tick(wrapper, [])
		expect(panelMembers(wrapper)).toEqual([])
		expect(editsCommon(wrapper)).toBe(true)
		await tick(wrapper, ABC)
		expect(editsCommon(wrapper)).toBe(true)
		expect(byId(wrapper, 'enroll-details').exists()).toBe(false)

		await panelEmit(wrapper, 'close', undefined)
		expect(byId(wrapper, 'payment-panel').exists()).toBe(false)
		expect(part(wrapper, 'EnrollStudentTable').props('compact')).toBe(false)
	})

	it('a single student ticked on their own gets their own panel', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, ['a@x.com'], preview([row('a@x.com')]))
		await tick(wrapper, ['a@x.com'])
		await click(wrapper, 'enroll-details')
		expect(panelMembers(wrapper)).toEqual(['a@x.com'])
	})

	it('shows the disabled Enroll button while pasted emails are checked', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		await tick(wrapper, ['a@x.com'])
		part(wrapper, 'EnrollSelectStep').vm.$emit('update:checking', true)
		await flushPromises()
		expect(byId(wrapper, 'enroll-details').exists()).toBe(false)
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()

		const free = mountForm()
		await select(free, AB)
		part(free, 'EnrollSelectStep').vm.$emit('update:checking', true)
		await flushPromises()
		expect(byId(free, 'enroll-submit').attributes('disabled')).toBeDefined()
	})

	it('keeps Enroll disabled while a preview is loading or after it fails', async () => {
		const wrapper = mountForm({ target: paidCourse })
		resources[PREVIEW].submit.mockImplementation(() => new Promise(() => {}))
		await select(wrapper, AB)
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()

		resources[PREVIEW].submit.mockImplementation(
			async (_params: unknown, options: Handlers) => {
				options.onError?.({ messages: ['Nope.'] })
				throw new Error('failed')
			}
		)
		await select(wrapper, [...AB, 'c@x.com'])
		expect(toastErrorMock).toHaveBeenCalledWith('Nope.')
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()
	})

	it('ignores a preview that answers after a newer one', async () => {
		const wrapper = mountForm({ target: paidCourse })
		let late: Handlers = {}
		resources[PREVIEW].submit.mockImplementationOnce(
			(_params: unknown, options: Handlers) => {
				late = options
				return new Promise(() => {})
			}
		)
		await select(wrapper, ['a@x.com'])
		respond(PREVIEW, ABPreview())
		await select(wrapper, AB)
		late.onSuccess?.(preview([row('a@x.com', 'enrolled')]))
		await flushPromises()
		expect(tableRows(wrapper).map((item) => item.member)).toEqual(AB)
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): a preview still in
	// flight when its student was removed restored that student's row, and the
	// stale count disabled Enroll for the students who fit the seats.
	it('ignores a preview that answers after its student was removed', async () => {
		const wrapper = mountForm({ target: paidBatch })
		const ABC = [...AB, 'c@x.com']
		const twoSeats = (members: string[]) =>
			preview(
				members.map((m) => row(m)),
				{ seats_left: 2 }
			)
		await selectPaid(wrapper, AB, twoSeats(AB))
		let late: Handlers = {}
		resources[PREVIEW].submit.mockImplementationOnce(
			(_params: unknown, options: Handlers) => {
				late = options
				return new Promise(() => {})
			}
		)
		await select(wrapper, ABC)
		await select(wrapper, AB)
		late.onSuccess?.(twoSeats(ABC))
		await flushPromises()
		expect(wrapper.find('[data-testid="error"]').exists()).toBe(false)
		await addressForAll(wrapper)
		expect(
			byId(wrapper, 'enroll-submit').attributes('disabled')
		).toBeUndefined()
	})

	it('the selection banner removes and resets the ticked students', async () => {
		const wrapper = mountForm({ target: paidCourse })
		const ABC = [...AB, 'c@x.com']
		await selectPaid(wrapper, ABC, preview(ABC.map((m) => row(m))))
		await addressForAll(wrapper)
		await openForAll(wrapper)
		await panelEmit(wrapper, 'update:overrides', {
			'a@x.com': { ...emptyOverride(), amount: 1 },
			'b@x.com': { ...emptyOverride(), amount: 2 },
			'c@x.com': { ...emptyOverride(), amount: 3 },
		})
		await panelEmit(wrapper, 'update:choices', {
			'a@x.com': { mode: 'link', payment: 'P1' },
			'b@x.com': { mode: 'create' },
			'c@x.com': { mode: 'create' },
		})

		part(wrapper, 'EnrollStudentTable').vm.$emit('reset', AB)
		await flushPromises()
		expect(part(wrapper, 'EnrollPaymentPanel').props('overrides')).toEqual({
			'c@x.com': { ...emptyOverride(), amount: 3 },
		})
		expect(part(wrapper, 'EnrollPaymentPanel').props('choices')).toEqual({
			'a@x.com': { mode: 'create' },
			'b@x.com': { mode: 'create' },
			'c@x.com': { mode: 'create' },
		})

		part(wrapper, 'EnrollStudentTable').vm.$emit('remove', ['c@x.com'])
		await flushPromises()
		expect(part(wrapper, 'EnrollSelectStep').props('members')).toEqual(AB)
		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual(AB)
		expect(part(wrapper, 'EnrollPaymentPanel').props('overrides')).toEqual({})
		expect(resources[PREVIEW].submit).toHaveBeenCalledTimes(1)
		const params = await submitParams(wrapper)
		expect(params.members).toBe(JSON.stringify(AB))
		expect(params).not.toHaveProperty('member_payment_details')
	})

	it('removing the ticked students with payments off clears the selection', async () => {
		const wrapper = mountForm()
		await select(wrapper, AB)
		await tick(wrapper, ['a@x.com'])
		part(wrapper, 'EnrollStudentTable').vm.$emit('remove', ['a@x.com'])
		await flushPromises()
		expect(part(wrapper, 'EnrollSelectStep').props('members')).toEqual([
			'b@x.com',
		])
		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual([])
		expect(byId(wrapper, 'payment-panel').exists()).toBe(false)
	})

	it('Enter details names the students still missing details, not the ticked ones', async () => {
		const wrapper = mountForm({ target: paidCourse })
		const ABC = [...AB, 'c@x.com']
		await selectPaid(wrapper, ABC, preview(ABC.map((m) => row(m))))
		await addressForAll(wrapper)
		const partial = { ...emptyAddress(), state: 'MH' }
		await tick(wrapper, ['c@x.com'])
		await click(wrapper, 'enroll-details')
		await panelEmit(wrapper, 'update:overrides', {
			'c@x.com': { ...emptyOverride(), address: partial },
		})
		await panelEmit(wrapper, 'close', undefined)

		await tick(wrapper, AB)
		const details = byId(wrapper, 'enroll-details')
		expect(details.text()).toBe('Enter details for Name c@x.com')
		expect(details.attributes('data-variant')).toBe('solid')
		focusFirstMock.mockClear()
		await click(wrapper, 'enroll-details')
		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual([
			'c@x.com',
		])
		expect(panelMembers(wrapper)).toEqual(['c@x.com'])
		expect(part(wrapper, 'EnrollPaymentPanel').props('flagMissing')).toBe(true)
		expect(focusFirstMock).toHaveBeenCalledTimes(1)

		await panelEmit(wrapper, 'update:overrides', {
			'b@x.com': { ...emptyOverride(), address: partial },
			'c@x.com': { ...emptyOverride(), address: partial },
		})
		await panelEmit(wrapper, 'close', undefined)
		await tick(wrapper, ['a@x.com'])
		expect(byId(wrapper, 'enroll-details').text()).toBe(
			'Enter details for 2 students'
		)
		await click(wrapper, 'enroll-details')
		expect(panelMembers(wrapper)).toEqual(['b@x.com', 'c@x.com'])
	})

	it('closing the details panel unticks every student', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		await tick(wrapper, ['a@x.com'])
		await click(wrapper, 'enroll-details')
		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual([
			'a@x.com',
		])
		await panelEmit(wrapper, 'close', undefined)
		expect(byId(wrapper, 'payment-panel').exists()).toBe(false)
		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual([])

		await tick(wrapper, ['b@x.com'])
		await click(wrapper, 'enroll-details')
		await panelEmit(wrapper, 'back', undefined)
		expect(part(wrapper, 'EnrollStudentTable').props('ticked')).toEqual([])
	})

	it('submits the common details', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		await click(wrapper, 'enroll-details')
		await panelEmit(wrapper, 'update:defaults', {
			amount: 100,
			currency: 'INR',
			source: 'Web',
			address: SAVED,
		})
		const params = await submitParams(wrapper)
		expect(params).toMatchObject({
			course: 'C1',
			members: JSON.stringify(AB),
			purchased_certificate: false,
			linked_payments: '{}',
		})
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
			source: 'Web',
			address: 'ADDR-1',
		})
		expect(params).not.toHaveProperty('member_payment_details')
	})

	it('submits a group override for every ticked student beside the common details', async () => {
		const wrapper = mountForm({ target: paidCourse })
		const ABC = [...AB, 'c@x.com']
		await selectPaid(wrapper, ABC, preview(ABC.map((m) => row(m))))
		await addressForAll(wrapper)
		await tick(wrapper, AB)
		await click(wrapper, 'enroll-details')
		const group = { ...emptyOverride(), amount: 40, source: 'Referral' }
		await panelEmit(wrapper, 'update:overrides', {
			'a@x.com': group,
			'b@x.com': group,
		})
		const params = await submitParams(wrapper)
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
			address: 'ADDR-1',
		})
		expect(JSON.parse(params.member_payment_details as string)).toEqual({
			'a@x.com': { amount: 40, source: 'Referral' },
			'b@x.com': { amount: 40, source: 'Referral' },
		})
	})

	it('submits the common address and a student address that replaces it', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		await click(wrapper, 'enroll-details')
		const common = {
			...emptyAddress(),
			address_line1: 'Andheri',
			city: 'Mumbai',
			country: 'India',
		}
		await panelEmit(wrapper, 'update:defaults', {
			amount: 100,
			currency: 'INR',
			source: null,
			address: common,
		})
		await panelEmit(wrapper, 'update:overrides', {
			'b@x.com': {
				...emptyOverride(),
				address: {
					...emptyAddress(),
					address_line1: '1 Main St',
					city: 'London',
					country: 'UK',
				},
			},
		})
		expect(tableRows(wrapper)[0].billing).toBe('Andheri, Mumbai, India')
		expect(tableRows(wrapper)[0].needsAddress).toBe(false)
		const params = await submitParams(wrapper)
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
			address: { address_line1: 'Andheri', city: 'Mumbai', country: 'India' },
		})
		expect(JSON.parse(params.member_payment_details as string)).toEqual({
			'b@x.com': {
				address: { address_line1: '1 Main St', city: 'London', country: 'UK' },
			},
		})
	})

	it('submits a picked existing address by name and lists its summary', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, ABPreview())
		await openForAll(wrapper)
		await panelEmit(wrapper, 'update:defaults', {
			amount: 100,
			currency: 'INR',
			source: null,
			address: { name: 'ADDR-1', summary: 'Andheri, Mumbai' },
		})
		await panelEmit(wrapper, 'update:overrides', {
			'b@x.com': {
				...emptyOverride(),
				address: { name: 'ADDR-2', summary: '' },
			},
		})
		expect(tableRows(wrapper).map((item) => item.billing)).toEqual([
			'Andheri, Mumbai',
			'ADDR-2',
		])
		const params = await submitParams(wrapper)
		expect(JSON.parse(params.payment_details as string).address).toBe('ADDR-1')
		expect(JSON.parse(params.member_payment_details as string)).toEqual({
			'b@x.com': { address: 'ADDR-2' },
		})
	})

	it('submits a linked payment and falls back to a new one when it is no longer offered', async () => {
		const linkable = (name: string) =>
			row('a@x.com', 'ready', {
				linkable_payments: [
					{ name, amount: 100, currency: 'INR', creation: '2026-01-01' },
				],
			})
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, AB, preview([linkable('P1'), row('b@x.com')]))
		await openForAll(wrapper)
		await panelEmit(wrapper, 'update:choices', {
			'a@x.com': { mode: 'link', payment: 'P1' },
			'b@x.com': { mode: 'create' },
		})
		expect(tableRows(wrapper)[0].payment).toBe('Linked · P1')
		expect(tableRows(wrapper).map((item) => item.needsAddress)).toEqual([
			false,
			true,
		])
		respond(PREVIEW, preview([linkable('P1'), row('b@x.com'), row('c@x.com')]))
		await select(wrapper, [...AB, 'c@x.com'])
		expect(part(wrapper, 'EnrollPaymentPanel').props('choices')).toMatchObject({
			'a@x.com': { mode: 'link', payment: 'P1' },
		})
		await select(wrapper, AB)
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()
		await panelEmit(wrapper, 'update:overrides', {
			'b@x.com': { ...emptyOverride(), address: SAVED },
		})
		const params = await submitParams(wrapper)
		expect(JSON.parse(params.linked_payments as string)).toEqual({
			'a@x.com': 'P1',
		})
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
		})

		const again = mountForm({ target: paidCourse })
		await selectPaid(again, ['a@x.com'], preview([linkable('P1')]))
		await openForAll(again)
		await panelEmit(again, 'update:choices', {
			'a@x.com': { mode: 'link', payment: 'P1' },
		})
		respond(PREVIEW, preview([linkable('P2'), row('b@x.com')]))
		await select(again, AB)
		expect(part(again, 'EnrollPaymentPanel').props('choices')).toMatchObject({
			'a@x.com': { mode: 'create' },
		})
	})

	it('turning the paid switch off sends no payment arguments', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, ['a@x.com'], preview([row('a@x.com')]))
		expect(byId(wrapper, 'enroll-submit').exists()).toBe(false)
		part(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', false)
		await flushPromises()
		expect(byId(wrapper, 'enroll-details').exists()).toBe(false)
		expect(byId(wrapper, 'enroll-submit').text()).toBe('Enroll 1 student')
		const params = await submitParams(wrapper)
		expect(params).not.toHaveProperty('payment_details')
		expect(params).not.toHaveProperty('member_payment_details')
		expect(params).not.toHaveProperty('linked_payments')
		expect(params.members).toBe(JSON.stringify(['a@x.com']))
	})

	it('posts to add_students_to_batch for a batch target', async () => {
		const wrapper = mountForm({ target: paidBatch })
		respond(PREVIEW, preview([row('a@x.com')], { seats_left: 5 }))
		await select(wrapper, ['a@x.com'])
		await addressForAll(wrapper)
		respond(BATCH, { added: ['a@x.com'], errors: [] })
		await click(wrapper, 'enroll-submit')
		expect(resources[COURSE].submit).not.toHaveBeenCalled()
		expect(paramsOf(BATCH)).toMatchObject({
			batch: 'B1',
			members: JSON.stringify(['a@x.com']),
		})
	})

	it('says when there are not enough seats and gives it as the reason', async () => {
		const wrapper = mountForm({ target: paidBatch })
		await selectPaid(
			wrapper,
			AB,
			preview(
				AB.map((m) => row(m)),
				{ seats_left: 1 }
			)
		)
		await addressForAll(wrapper)
		expect(wrapper.get('[data-testid="error"]').text()).toBe(
			'1 seats left, 2 selected'
		)
		expect(byId(wrapper, 'enroll-submit').attributes('disabled')).toBeDefined()
		expect(byId(wrapper, 'enroll-reason').text()).toBe(
			'1 seats left, 2 selected'
		)
	})

	it('badges certificate rows New or Upgrade while the certificate is on', async () => {
		const wrapper = mountForm({
			target: { ...courseTarget, paidKind: 'certificate', priceLabel: '₹9' },
		})
		part(wrapper, 'EnrollSelectStep').vm.$emit('update:paid', true)
		await flushPromises()
		await selectPaid(
			wrapper,
			AB,
			preview([row('a@x.com'), row('b@x.com', 'upgrade')])
		)
		expect(paramsOf(PREVIEW).purchased_certificate).toBe(true)
		expect(tableRows(wrapper).map((item) => item.badge)).toEqual([
			'New',
			'Upgrade',
		])
	})

	it('leaves skipped preview rows out of the list and the submit', async () => {
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(
			wrapper,
			AB,
			preview([row('a@x.com'), row('b@x.com', 'enrolled')])
		)
		expect(tableRows(wrapper).map((item) => item.member)).toEqual(['a@x.com'])
		await addressForAll(wrapper)
		expect(byId(wrapper, 'enroll-submit').text()).toBe('Enroll 1 student')
		respond(COURSE, { added: ['a@x.com'], errors: [] })
		await click(wrapper, 'enroll-submit')
		expect(paramsOf(COURSE).members).toBe(JSON.stringify(['a@x.com']))
	})

	it('keeps one dialog size with the panel closed and open', async () => {
		const wrapper = mountForm({ target: paidCourse })
		expect(part(wrapper, 'Dialog').props('size')).toBe('4xl')
		const sizes = [bodyClass(wrapper)]
		await selectPaid(wrapper, ['a@x.com'], preview([row('a@x.com')]))
		sizes.push(bodyClass(wrapper))
		await click(wrapper, 'enroll-details')
		expect(byId(wrapper, 'payment-panel').exists()).toBe(true)
		sizes.push(bodyClass(wrapper))
		expect(sizes[0]).toMatch(/(^| )h-\[/)
		expect(new Set(sizes).size).toBe(1)
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): the content had an
	// aria-label but no role, so screen readers announced no name for it.
	it('names the content as a group', async () => {
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com'])
		const content = byId(wrapper, 'enroll-content')
		expect(content.attributes('role')).toBe('group')
		expect(content.attributes('aria-label')).toBe('Enroll Students')
	})

	it('does not scroll the form itself, so only the list scrolls', async () => {
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com'])
		const content = byId(wrapper, 'enroll-content')
		expect(content.classes()).toContain('overflow-hidden')
		expect(content.classes()).not.toContain('overflow-y-auto')
	})

	it('toasts success, emits enrolled once and closes', async () => {
		const wrapper = mountForm()
		await select(wrapper, AB)
		respond(COURSE, { added: AB, errors: [] })
		await click(wrapper, 'enroll-submit')
		const result = { added: AB, upgraded: [], errors: [] }
		expect(wrapper.emitted('enrolled')).toEqual([[result]])
		expect(toastMock.success).toHaveBeenCalledWith('2 students enrolled', {
			description: undefined,
		})
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('on partial failure warns, stays open and keeps only the failed students', async () => {
		const wrapper = mountForm()
		await select(wrapper, AB)
		const errors = [{ member: 'b@x.com', error: 'Already enrolled' }]
		respond(COURSE, { added: ['a@x.com'], errors })
		await click(wrapper, 'enroll-submit')
		expect(toastMock.warning).toHaveBeenCalledWith(
			'1 student enrolled, 1 student could not be enrolled',
			{ description: 'b@x.com: Already enrolled' }
		)
		expect(wrapper.emitted('close')).toBeUndefined()
		expect(byId(wrapper, 'enroll-submit').text()).toBe('Enroll 1 student')
	})

	it('stays put and toasts the server message when submit fails', async () => {
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
		expect(byId(wrapper, 'select-step').exists()).toBe(true)
		expect(wrapper.emitted('enrolled')).toBeUndefined()
	})

	it('submits once while enrolling', async () => {
		const wrapper = mountForm()
		await select(wrapper, ['a@x.com'])
		resources[COURSE].submit.mockImplementation(() => {
			resources[COURSE].loading = true
			return new Promise(() => {})
		})
		await click(wrapper, 'enroll-submit')
		await click(wrapper, 'enroll-submit')
		expect(resources[COURSE].submit).toHaveBeenCalledTimes(1)
	})

	it('on mobile, the panel replaces the list and back returns to it first', async () => {
		setWidth(375)
		const wrapper = mountForm({ target: paidCourse })
		await selectPaid(wrapper, ['a@x.com'], preview([row('a@x.com')]))
		expect(part(wrapper, 'EnrollStudentTable').props('compact')).toBe(true)
		await click(wrapper, 'enroll-details')
		expect(byId(wrapper, 'student-table').exists()).toBe(false)
		expect(part(wrapper, 'EnrollPaymentPanel').props('showBack')).toBe(true)

		await click(wrapper, 'form-shell-back')
		expect(byId(wrapper, 'student-table').exists()).toBe(true)
		expect(wrapper.emitted('close')).toBeUndefined()
		await click(wrapper, 'form-shell-back')
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('on mobile, the header action reads Enroll N students when unpaid', async () => {
		setWidth(375)
		const wrapper = mountForm()
		await select(wrapper, AB)
		const header = wrapper.get('[data-testid="form-shell-header-actions"]')
		expect(header.get('[data-testid="enroll-submit"]').text()).toBe(
			'Enroll 2 students'
		)
	})
})
