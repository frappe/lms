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
	paidSwitchLabel,
	parseEmailList,
	priceHint,
	statusLabel,
	summaryLine,
} from '@/components/Enrollment/enrollment'
import type {
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
	PaymentChoice,
	PaymentDefaults,
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
}

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
			switchLabel: 'Students have paid for this course',
			hint: 'Course price $10',
		},
		{
			kind: 'certificate',
			switchLabel: 'Students have purchased the certificate',
			hint: 'Certificate price $10',
		},
		{
			kind: 'batch',
			switchLabel: 'Students have paid for this batch',
			hint: 'Batch price $10',
		},
	] as const)('labels for $kind', ({ kind, switchLabel, hint }) => {
		expect(paidSwitchLabel(kind)).toBe(switchLabel)
		expect(priceHint(kind, '$10')).toBe(hint)
	})

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
			buildSubmitParams(courseTarget, ['a@x.com'], false, defaults, choices)
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
				choices
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
			choices
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
			choices
		)
		expect(batch.batch).toBe('b1')
		expect('course' in batch).toBe(false)
		expect('purchased_certificate' in batch).toBe(false)
	})

	it('buildSubmitParams sends no payment details when every student links one', () => {
		const params = buildSubmitParams(
			courseTarget,
			['a@x.com'],
			true,
			{ ...defaults, source: null },
			{ 'a@x.com': { mode: 'link', payment: 'P1' } }
		)
		expect('payment_details' in params).toBe(false)
		expect(JSON.parse(params.linked_payments as string)).toEqual({
			'a@x.com': 'P1',
		})
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
			ok: false,
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
		expect(canSubmitPayments(d, ['a@x.com'], c)).toBe(ok)
	)
})
