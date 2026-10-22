import { describe, expect, it, test, vi } from 'vitest'
import {
	buildSubmitParams,
	canSubmitPayments,
	enrollButtonLabel,
	exceedsSeats,
	isEnrollable,
	mergeMembers,
	normalizeResult,
	paidKindForBatch,
	paidKindForCourse,
	paidSwitchDescription,
	paidSwitchLabel,
	parseEmailList,
	paymentSummary,
	paidByDefault,
	addressSummary,
	emptyAddress,
	emptyOverride,
	effectivePayment,
	hasOverride,
	listPaymentLabel,
	missingPaymentDetails,
	statusLabel,
	summaryLine,
} from '@/components/Enrollment/enrollment'
import type {
	BillingAddress,
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
	PaymentChoice,
	PaymentDefaults,
	PaymentOverride,
} from '@/types'

vi.stubGlobal('__', (text: string, args: unknown[] = []) =>
	text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)]))
)

const row = (member: string, status: EnrollStatus): EnrollPreviewRow => ({
	member,
	full_name: null,
	user_image: null,
	status,
	linkable_payments: [],
})

const defaults: PaymentDefaults = {
	amount: 100,
	currency: 'INR',
	source: 'Offline',
	address: emptyAddress(),
}

const address = (fields: Partial<BillingAddress> = {}): BillingAddress => ({
	...emptyAddress(),
	...fields,
})

const fullAddress = address({
	address_line1: '1 Main St',
	city: 'Pune',
	country: 'India',
})

const override = (
	fields: Partial<Omit<PaymentOverride, 'address'>> = {},
	addressFields?: Partial<BillingAddress>
): PaymentOverride => ({
	...emptyOverride(),
	...fields,
	address: addressFields ? address(addressFields) : null,
})

const courseTarget: EnrollTarget = {
	doctype: 'LMS Course',
	name: 'c1',
	paidKind: 'course',
	priceLabel: null,
}

describe('enrollment helpers', () => {
	test.each([
		{ input: 'a@x.com, b@x.com', out: ['a@x.com', 'b@x.com'] },
		{
			input: 'A@x.com; b@x.com\n a@x.com,,',
			out: ['A@x.com', 'b@x.com'],
		},
		{ input: '  ', out: [] },
	])('parseEmailList($input)', ({ input, out }) =>
		expect(parseEmailList(input)).toEqual(out)
	)

	it('mergeMembers keeps order, skips duplicates and reports overflow past max', () => {
		expect(mergeMembers(['a'], ['b', 'a', 'c'], 2)).toEqual({
			members: ['a', 'b'],
			overflow: 1,
		})
	})

	test.each([
		{ course: { paid_course: 1, paid_certificate: 1 }, kind: 'course' },
		{ course: { paid_course: 0, paid_certificate: 1 }, kind: 'certificate' },
		{ course: {}, kind: null },
	])('paidKindForCourse -> $kind', ({ course, kind }) =>
		expect(paidKindForCourse(course)).toBe(kind)
	)

	test.each([
		{ batch: { paid_batch: 1, can_manage: true }, kind: 'batch' },
		{ batch: { paid_batch: 1, can_manage: false }, kind: null },
		{ batch: { paid_batch: 0, can_manage: true }, kind: null },
	])('paidKindForBatch -> $kind', ({ batch, kind }) =>
		expect(paidKindForBatch(batch)).toBe(kind)
	)

	test.each([
		{
			kind: 'course',
			label: 'Record payments',
			description:
				'Course price $10. Turn off to enroll without a payment record.',
			on: true,
		},
		{
			kind: 'batch',
			label: 'Record payments',
			description:
				'Batch price $10. Turn off to enroll without a payment record.',
			on: true,
		},
		{
			kind: 'certificate',
			label: 'Include paid certificate',
			description:
				'Students get the certificate and a payment is recorded for each. Certificate price $10.',
			on: false,
		},
	] as const)('switch copy for $kind', ({ kind, label, description, on }) => {
		expect(paidSwitchLabel(kind)).toBe(label)
		expect(paidSwitchDescription(kind, '$10')).toBe(description)
		expect(paidByDefault(kind)).toBe(on)
	})

	test.each([
		{
			kind: 'course',
			description: 'Turn off to enroll without a payment record.',
		},
		{
			kind: 'certificate',
			description:
				'Students get the certificate and a payment is recorded for each.',
		},
	] as const)(
		'$kind switch drops the price sentence without a price',
		({ kind, description }) =>
			expect(paidSwitchDescription(kind, null)).toBe(description)
	)

	test.each([
		{ status: 'ready', label: 'Ready', enrollable: true },
		{
			status: 'enrolled',
			label: 'Already enrolled (will be skipped)',
			enrollable: false,
		},
		{
			status: 'no_user',
			label: 'No user with this email (will be skipped)',
			enrollable: false,
		},
		{
			status: 'disabled',
			label: 'User is disabled (will be skipped)',
			enrollable: false,
		},
		{
			status: 'upgrade',
			label: 'Enrolled, will get certificate',
			enrollable: true,
		},
		{
			status: 'certificate_purchased',
			label: 'Certificate already purchased (will be skipped)',
			enrollable: false,
		},
	] as const)('status $status', ({ status, label, enrollable }) => {
		expect(statusLabel(status)).toBe(label)
		expect(isEnrollable(status)).toBe(enrollable)
	})

	test.each([
		{ ready: 3, seats: 3, over: false },
		{ ready: 4, seats: 3, over: true },
		{ ready: 40, seats: null, over: false },
		{ ready: 1, seats: -2, over: true },
		{ ready: 0, seats: -2, over: false },
		{ ready: 0, seats: 0, over: false },
	])('exceedsSeats ready=$ready seats=$seats', ({ ready, seats, over }) => {
		const rows = [
			...Array.from({ length: ready }, (_, i) => row(`r${i}`, 'ready')),
			row('e', 'enrolled'),
			row('u', 'upgrade'),
		]
		expect(exceedsSeats(rows, seats)).toBe(over)
	})

	it('normalizeResult defaults upgraded to an empty list', () => {
		expect(normalizeResult({ added: ['a'], errors: [] })).toEqual({
			added: ['a'],
			upgraded: [],
			errors: [],
		})
	})

	it('summaryLine mentions upgrades only when there are any', () => {
		const err = { member: 'z', error: 'x' }
		expect(
			summaryLine({ added: ['a', 'b'], upgraded: [], errors: [err] }, 0)
		).toBe('2 enrolled, 1 skipped')
		expect(
			summaryLine({ added: ['a'], upgraded: ['b', 'c'], errors: [] }, 0)
		).toBe('1 enrolled, 2 upgraded to certificate, 0 skipped')
		expect(summaryLine({ added: ['a'], upgraded: [], errors: [err] }, 2)).toBe(
			'1 enrolled, 3 skipped'
		)
	})

	it('enrollButtonLabel pluralises', () => {
		expect(enrollButtonLabel(1)).toBe('Enroll 1 student')
		expect(enrollButtonLabel(3)).toBe('Enroll 3 students')
	})

	it('buildSubmitParams sends no payment arguments when the switch is off', () => {
		const choices = {
			'a@x.com': { mode: 'link', payment: 'P1' } as PaymentChoice,
		}
		expect(
			buildSubmitParams(courseTarget, ['a@x.com'], false, defaults, choices, {})
		).toEqual({
			course: 'c1',
			members: '["a@x.com"]',
			purchased_certificate: false,
		})
		expect(
			buildSubmitParams(
				{
					doctype: 'LMS Batch',
					name: 'b1',
					paidKind: 'batch',
					priceLabel: null,
				},
				['a@x.com'],
				false,
				defaults,
				choices,
				{}
			)
		).toEqual({ batch: 'b1', members: '["a@x.com"]' })
	})

	it('buildSubmitParams sends linked payments only for link choices with a payment', () => {
		const choices: Record<string, PaymentChoice> = {
			'a@x.com': { mode: 'link', payment: 'P1' },
			'b@x.com': { mode: 'link', payment: null },
			'c@x.com': { mode: 'create' },
		}
		const members = ['a@x.com', 'b@x.com', 'c@x.com']
		const params = buildSubmitParams(
			{ ...courseTarget, paidKind: 'certificate' },
			members,
			true,
			defaults,
			choices,
			{}
		)
		expect(params.purchased_certificate).toBe(true)
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
			source: 'Offline',
		})
		expect(JSON.parse(params.linked_payments as string)).toEqual({
			'a@x.com': 'P1',
		})
		const batch = buildSubmitParams(
			{ doctype: 'LMS Batch', name: 'b1', paidKind: 'batch', priceLabel: null },
			members,
			true,
			defaults,
			choices,
			{}
		)
		expect(batch.batch).toBe('b1')
		expect('course' in batch).toBe(false)
		expect('purchased_certificate' in batch).toBe(false)
	})

	it('buildSubmitParams omits an empty source from the common details', () => {
		const params = buildSubmitParams(
			courseTarget,
			['a@x.com'],
			true,
			{ ...defaults, source: null },
			{},
			{}
		)
		const details = JSON.parse(params.payment_details as string)
		expect('source' in details).toBe(false)
		expect(details.amount).toBe(100)
	})

	test.each([
		{ label: 'complete', d: defaults, c: {}, ok: true },
		{ label: 'zero amount', d: { ...defaults, amount: 0 }, c: {}, ok: true },
		{
			label: 'null amount',
			d: { ...defaults, amount: null },
			c: {},
			ok: false,
		},
		{
			label: 'negative amount',
			d: { ...defaults, amount: -1 },
			c: {},
			ok: false,
		},
		{ label: 'NaN amount', d: { ...defaults, amount: NaN }, c: {}, ok: false },
		{
			label: 'missing source',
			d: { ...defaults, source: null },
			c: {},
			ok: true,
		},
		{
			label: 'missing currency',
			d: { ...defaults, currency: null },
			c: {},
			ok: false,
		},
		{
			label: 'link without payment',
			d: defaults,
			c: { 'a@x.com': { mode: 'link', payment: null } },
			ok: false,
		},
		{
			label: 'link with payment',
			d: defaults,
			c: { 'a@x.com': { mode: 'link', payment: 'P1' } },
			ok: true,
		},
		{
			label: 'all linked without source',
			d: { ...defaults, amount: null, source: null },
			c: { 'a@x.com': { mode: 'link', payment: 'P1' } },
			ok: true,
		},
	] as {
		label: string
		d: PaymentDefaults
		c: Record<string, PaymentChoice>
		ok: boolean
	}[])('canSubmitPayments $label', ({ d, c, ok }) =>
		expect(canSubmitPayments(d, ['a@x.com'], c, {})).toBe(ok)
	)
})

describe('per-student payment details', () => {
	it('effectivePayment prefers the student value over the common one', () => {
		expect(
			effectivePayment(
				{ ...defaults, address: fullAddress },
				override({ amount: 50, source: 'Referral' })
			)
		).toEqual({
			amount: 50,
			currency: 'INR',
			source: 'Referral',
			address: fullAddress,
		})
		expect(effectivePayment(defaults, null)).toEqual(defaults)
	})

	it('a student address replaces the common address entirely', () => {
		const common = address({ ...fullAddress, pincode: '411001', phone: '9' })
		const own = { address_line1: '10 Downing St', city: 'London' }
		expect(
			effectivePayment({ ...defaults, address: common }, override({}, own))
				.address
		).toEqual(address(own))
	})

	it('hasOverride is false for an untouched or cleared override', () => {
		expect(hasOverride(undefined)).toBe(false)
		expect(hasOverride(emptyOverride())).toBe(false)
		expect(hasOverride(override({ billing_name: 'J' }))).toBe(true)
		expect(hasOverride(override({}, {}))).toBe(true)
	})

	it('missingPaymentDetails names every field a student still needs', () => {
		expect(missingPaymentDetails(defaults, null)).toEqual([])
		expect(
			missingPaymentDetails({ ...defaults, amount: null, source: null }, null)
		).toEqual(['Amount'])
		expect(
			missingPaymentDetails(
				{ ...defaults, address: address({ city: 'Pune' }) },
				null
			)
		).toEqual(['Address line 1', 'Country'])
		expect(missingPaymentDetails(defaults, override({}, {}))).toEqual([
			'Address line 1',
			'City',
			'Country',
		])
		expect(
			missingPaymentDetails(
				{ ...defaults, address: address({ city: 'Pune' }) },
				override({}, fullAddress)
			)
		).toEqual([])
	})

	it('listPaymentLabel shows the amount and source, or the linked payment', () => {
		expect(
			listPaymentLabel({ mode: 'create' }, { ...defaults, source: 'Website' })
		).toMatch(/^.*100.* · Website$/)
		expect(
			listPaymentLabel({ mode: 'create' }, { ...defaults, source: null })
		).toMatch(/^.*100[^·]*$/)
		expect(listPaymentLabel({ mode: 'link', payment: 'P1' }, defaults)).toBe(
			'Linked · P1'
		)
		expect(listPaymentLabel({ mode: 'link', payment: null }, defaults)).toBe(
			'Linked · Not selected'
		)
	})

	it('buildSubmitParams sends the common address and only overridden student fields', () => {
		const params = buildSubmitParams(
			courseTarget,
			['a@x.com', 'b@x.com', 'c@x.com'],
			true,
			{ ...defaults, address: address({ ...fullAddress, state: '' }) },
			{ 'c@x.com': { mode: 'link', payment: 'P1' } },
			{
				'a@x.com': override(
					{ amount: 0, billing_name: 'Acme Ltd' },
					{ city: 'Delhi' }
				),
				'b@x.com': emptyOverride(),
				'c@x.com': override({ amount: 5 }),
			}
		)
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
			source: 'Offline',
			address: { address_line1: '1 Main St', city: 'Pune', country: 'India' },
		})
		expect(JSON.parse(params.member_payment_details as string)).toEqual({
			'a@x.com': {
				amount: 0,
				billing_name: 'Acme Ltd',
				address: { city: 'Delhi' },
			},
		})
	})

	it('buildSubmitParams sends no member details when nothing is overridden', () => {
		const params = buildSubmitParams(
			courseTarget,
			['a@x.com'],
			true,
			defaults,
			{},
			{ 'a@x.com': emptyOverride() }
		)
		expect('member_payment_details' in params).toBe(false)
		expect(JSON.parse(params.payment_details as string)).toEqual({
			amount: 100,
			currency: 'INR',
			source: 'Offline',
		})
	})

	it('buildSubmitParams sends no member details when every student links a payment', () => {
		const params = buildSubmitParams(
			courseTarget,
			['a@x.com'],
			true,
			defaults,
			{ 'a@x.com': { mode: 'link', payment: 'P1' } },
			{ 'a@x.com': override({ amount: 5 }) }
		)
		expect('payment_details' in params).toBe(false)
		expect('member_payment_details' in params).toBe(false)
	})

	test.each([
		{ label: 'no address', d: defaults, o: {}, ok: true },
		{
			label: 'complete common address',
			d: { ...defaults, address: fullAddress },
			o: {},
			ok: true,
		},
		{
			label: 'partial common address',
			d: { ...defaults, address: address({ city: 'Pune' }) },
			o: {},
			ok: false,
		},
		{
			label: 'student completes a partial common address',
			d: { ...defaults, address: address({ city: 'Pune' }) },
			o: {
				'a@x.com': override(
					{},
					{ address_line1: '1 Main St', country: 'India' }
				),
			},
			ok: false,
		},
		{
			label: 'partial student address',
			d: defaults,
			o: { 'a@x.com': override({}, { phone: '99' }) },
			ok: false,
		},
		{
			label: 'empty different student address',
			d: { ...defaults, address: fullAddress },
			o: { 'a@x.com': override({}, {}) },
			ok: false,
		},
		{
			label: 'complete different student address',
			d: defaults,
			o: { 'a@x.com': override({}, fullAddress) },
			ok: true,
		},
		{
			label: 'student amount fixes a missing common amount',
			d: { ...defaults, amount: null },
			o: { 'a@x.com': override({ amount: 10 }) },
			ok: false,
		},
		{
			label: 'negative student amount',
			d: defaults,
			o: { 'a@x.com': override({ amount: -1 }) },
			ok: false,
		},
	] as {
		label: string
		d: PaymentDefaults
		o: Record<string, PaymentOverride>
		ok: boolean
	}[])('canSubmitPayments with $label', ({ d, o, ok }) =>
		expect(canSubmitPayments(d, ['a@x.com'], {}, o)).toBe(ok)
	)

	it('addressSummary is one line, or empty for no address', () => {
		expect(addressSummary(emptyAddress())).toBe('')
		expect(addressSummary(address({ ...fullAddress, state: 'MH' }))).toBe(
			'1 Main St, Pune, MH, India'
		)
	})

	it('paymentSummary names a new or a linked payment', () => {
		expect(
			paymentSummary({ mode: 'create' }, { ...defaults, source: 'Website' })
		).toMatch(/^New · .*100.* · Website$/)
		expect(
			paymentSummary({ mode: 'create' }, { ...defaults, source: null })
		).toMatch(/^New · [^·]*100[^·]*$/)
		expect(paymentSummary({ mode: 'link', payment: 'P1' }, defaults)).toBe(
			'Linked · P1'
		)
	})
})
