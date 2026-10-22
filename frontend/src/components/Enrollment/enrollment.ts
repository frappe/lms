import type {
	AddressField,
	BillingAddress,
	BulkEnrollError,
	BulkEnrollResult,
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
	PaidKind,
	PaymentChoice,
	PaymentDefaults,
	PaymentField,
	PaymentOverride,
} from '@/types'

export const MAX_STUDENTS = 50

type Flag = number | boolean | undefined

export const parseEmailList = (text: string): string[] => {
	const seen = new Set<string>()
	const emails: string[] = []
	for (const part of text.split(/[\s,;]+/)) {
		const email = part.trim()
		const key = email.toLowerCase()
		if (!email || seen.has(key)) continue
		seen.add(key)
		emails.push(email)
	}
	return emails
}

export const mergeMembers = (
	current: readonly string[],
	added: readonly string[],
	max: number
): { members: string[]; overflow: number } => {
	const members = [...current]
	const seen = new Set(members.map((m) => m.toLowerCase()))
	let overflow = 0
	for (const member of added) {
		const key = member.toLowerCase()
		if (seen.has(key)) continue
		seen.add(key)
		if (members.length >= max) {
			overflow++
			continue
		}
		members.push(member)
	}
	return { members, overflow }
}

export const paidKindForCourse = (course: {
	paid_course?: Flag
	paid_certificate?: Flag
}): PaidKind | null => {
	if (course.paid_course) return 'course'
	if (course.paid_certificate) return 'certificate'
	return null
}

export const paidKindForBatch = (batch: {
	paid_batch?: Flag
	can_manage?: boolean
}): PaidKind | null => (batch.paid_batch && batch.can_manage ? 'batch' : null)

export const paidSwitchLabel = (kind: PaidKind): string =>
	kind === 'certificate'
		? __('Include paid certificate')
		: __('Record payments')

export const paidSwitchDescription = (
	kind: PaidKind,
	price: string | null
): string => {
	if (kind === 'certificate') {
		const what = __(
			'Students get the certificate and a payment is recorded for each.'
		)
		return price ? `${what} ${__('Certificate price {0}.', [price])}` : what
	}
	const off = __('Turn off to enroll without a payment record.')
	if (!price) return off
	const priced =
		kind === 'course'
			? __('Course price {0}.', [price])
			: __('Batch price {0}.', [price])
	return `${priced} ${off}`
}

export const paidByDefault = (kind: PaidKind | null): boolean =>
	kind === 'course' || kind === 'batch'

export const statusLabel = (status: EnrollStatus): string => {
	switch (status) {
		case 'ready':
			return __('Ready')
		case 'enrolled':
			return __('Already enrolled (will be skipped)')
		case 'no_user':
			return __('No user with this email (will be skipped)')
		case 'disabled':
			return __('User is disabled (will be skipped)')
		case 'upgrade':
			return __('Enrolled, will get certificate')
		case 'certificate_purchased':
			return __('Certificate already purchased (will be skipped)')
	}
}

export const isEnrollable = (status: EnrollStatus): boolean =>
	status === 'ready' || status === 'upgrade'

export const exceedsSeats = (
	rows: readonly EnrollPreviewRow[],
	seatsLeft: number | null
): boolean => {
	if (seatsLeft === null) return false
	const ready = rows.filter((row) => row.status === 'ready').length
	return ready > Math.max(seatsLeft, 0)
}

export const normalizeResult = (raw: {
	added: string[]
	upgraded?: string[]
	errors: BulkEnrollError[]
}): BulkEnrollResult => ({
	added: raw.added,
	upgraded: raw.upgraded ?? [],
	errors: raw.errors,
})

export const summaryLine = (
	result: BulkEnrollResult,
	skippedBeforeSubmit: number
): string => {
	const skipped = result.errors.length + skippedBeforeSubmit
	if (result.upgraded.length) {
		return __('{0} enrolled, {1} upgraded to certificate, {2} skipped', [
			result.added.length,
			result.upgraded.length,
			skipped,
		])
	}
	return __('{0} enrolled, {1} skipped', [result.added.length, skipped])
}

export const enrollButtonLabel = (count: number): string =>
	count === 1 ? __('Enroll 1 student') : __('Enroll {0} students', [count])

export const ADDRESS_FIELDS: readonly AddressField[] = [
	'address_line1',
	'address_line2',
	'city',
	'state',
	'country',
	'pincode',
	'phone',
]

const REQUIRED_ADDRESS_FIELDS: readonly AddressField[] = [
	'address_line1',
	'city',
	'country',
]

export const emptyAddress = (): BillingAddress => ({
	address_line1: '',
	address_line2: '',
	city: '',
	state: '',
	country: '',
	pincode: '',
	phone: '',
})

export const paymentFieldLabel = (field: PaymentField): string => {
	switch (field) {
		case 'billing_name':
			return __('Billing name')
		case 'amount':
			return __('Amount')
		case 'currency':
			return __('Currency')
		case 'source':
			return __('Source')
		case 'address_line1':
			return __('Address line 1')
		case 'address_line2':
			return __('Address line 2')
		case 'city':
			return __('City')
		case 'state':
			return __('State')
		case 'country':
			return __('Country')
		case 'pincode':
			return __('Postal code')
		case 'phone':
			return __('Phone')
	}
}

export const emptyOverride = (): PaymentOverride => ({
	amount: null,
	currency: null,
	source: null,
	billing_name: null,
	address: null,
})

export const hasOverride = (override: PaymentOverride | undefined): boolean =>
	!!override &&
	(override.amount !== null ||
		override.currency !== null ||
		override.source !== null ||
		override.billing_name !== null ||
		override.address !== null)

export const effectivePayment = (
	defaults: PaymentDefaults,
	override: PaymentOverride | null
): PaymentDefaults => {
	if (!override) return defaults
	return {
		amount: override.amount ?? defaults.amount,
		currency: override.currency ?? defaults.currency,
		source: override.source ?? defaults.source,
		address: override.address ?? defaults.address,
	}
}

const isFilled = (value: string | null): value is string => !!value?.trim()

const addressPayload = (
	address: Readonly<BillingAddress>
): Partial<BillingAddress> | null => {
	const payload: Partial<BillingAddress> = {}
	for (const field of ADDRESS_FIELDS) {
		const value = address[field]
		if (isFilled(value)) payload[field] = value.trim()
	}
	return Object.keys(payload).length ? payload : null
}

export const missingAddressFields = (
	address: BillingAddress,
	required: boolean
): AddressField[] =>
	required || addressPayload(address)
		? REQUIRED_ADDRESS_FIELDS.filter((field) => !isFilled(address[field]))
		: []

export const addressSummary = (address: BillingAddress): string =>
	(['address_line1', 'address_line2', 'city', 'state', 'country'] as const)
		.map((field) => address[field].trim())
		.filter(Boolean)
		.join(', ')

export const isValidAmount = (amount: number | null): amount is number =>
	typeof amount === 'number' && Number.isFinite(amount) && amount >= 0

export const formatMoney = (
	amount: number | null,
	currency: string | null
): string => {
	if (amount === null) return ''
	if (!currency) return String(amount)
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency,
		}).format(amount)
	} catch {
		return `${amount} ${currency}`
	}
}

export const paymentSummary = (
	choice: PaymentChoice | undefined,
	payment: PaymentDefaults
): string => {
	if (choice?.mode === 'link') {
		return [__('Linked'), choice.payment ?? ''].filter(Boolean).join(' · ')
	}
	return [
		__('New'),
		formatMoney(payment.amount, payment.currency),
		payment.source ?? '',
	]
		.filter(Boolean)
		.join(' · ')
}

export const listPaymentLabel = (
	choice: PaymentChoice | undefined,
	payment: PaymentDefaults
): string => {
	if (choice?.mode === 'link') {
		return [__('Linked'), choice.payment ?? __('Not selected')].join(' · ')
	}
	return [formatMoney(payment.amount, payment.currency), payment.source ?? '']
		.filter(Boolean)
		.join(' · ')
}

const createsPayments = (
	members: readonly string[],
	choices: Readonly<Record<string, PaymentChoice>>
): boolean => members.some((member) => choices[member]?.mode !== 'link')

const overridePayload = (
	override: PaymentOverride
): Record<string, unknown> | null => {
	const payload: Record<string, unknown> = {}
	if (override.amount !== null) payload.amount = override.amount
	for (const key of ['currency', 'source', 'billing_name'] as const) {
		const value = override[key]
		if (isFilled(value)) payload[key] = value.trim()
	}
	if (override.address) payload.address = addressPayload(override.address) ?? {}
	return Object.keys(payload).length ? payload : null
}

const commonPayload = (defaults: PaymentDefaults): Record<string, unknown> => {
	const payload: Record<string, unknown> = {
		amount: defaults.amount,
		currency: defaults.currency,
	}
	if (isFilled(defaults.source)) payload.source = defaults.source.trim()
	const address = addressPayload(defaults.address)
	if (address) payload.address = address
	return payload
}

const targetParams = (
	target: EnrollTarget,
	members: readonly string[],
	paid: boolean
): Record<string, string | boolean> => {
	if (target.doctype === 'LMS Batch') {
		return { batch: target.name, members: JSON.stringify(members) }
	}
	return {
		course: target.name,
		members: JSON.stringify(members),
		purchased_certificate: paid && target.paidKind === 'certificate',
	}
}

const memberPayments = (
	members: readonly string[],
	choices: Readonly<Record<string, PaymentChoice>>,
	overrides: Readonly<Record<string, PaymentOverride>>
) => {
	const linked: Record<string, string> = {}
	const perMember: Record<string, Record<string, unknown>> = {}
	for (const member of members) {
		const choice = choices[member]
		if (choice?.mode === 'link') {
			if (choice.payment) linked[member] = choice.payment
			continue
		}
		const override = overrides[member]
		const payload = override ? overridePayload(override) : null
		if (payload) perMember[member] = payload
	}
	return { linked, perMember }
}

export const buildSubmitParams = (
	target: EnrollTarget,
	members: readonly string[],
	paid: boolean,
	defaults: PaymentDefaults,
	choices: Readonly<Record<string, PaymentChoice>>,
	overrides: Readonly<Record<string, PaymentOverride>>
): Record<string, string | boolean> => {
	const params = targetParams(target, members, paid)
	if (!paid) return params

	const { linked, perMember } = memberPayments(members, choices, overrides)
	if (createsPayments(members, choices)) {
		params.payment_details = JSON.stringify(commonPayload(defaults))
		if (Object.keys(perMember).length) {
			params.member_payment_details = JSON.stringify(perMember)
		}
	}
	params.linked_payments = JSON.stringify(linked)
	return params
}

export const missingPaymentDetails = (
	defaults: PaymentDefaults,
	override: PaymentOverride | null
): string[] => {
	const payment = effectivePayment(defaults, override)
	const missing: PaymentField[] = []
	if (!isValidAmount(payment.amount)) missing.push('amount')
	if (!payment.currency) missing.push('currency')
	missing.push(...missingAddressFields(payment.address, !!override?.address))
	return missing.map(paymentFieldLabel)
}

const isPaymentReady = (
	defaults: PaymentDefaults,
	override: PaymentOverride | null = null
): boolean => !missingPaymentDetails(defaults, override).length

export const canSubmitPayments = (
	defaults: PaymentDefaults,
	members: readonly string[],
	choices: Readonly<Record<string, PaymentChoice>>,
	overrides: Readonly<Record<string, PaymentOverride>>
): boolean => {
	const linksReady = members.every((member) => {
		const choice = choices[member]
		return choice?.mode !== 'link' || !!choice.payment
	})
	if (!linksReady) return false
	if (!createsPayments(members, choices)) return true
	if (!isPaymentReady(defaults)) return false
	return members.every(
		(member) =>
			choices[member]?.mode === 'link' ||
			isPaymentReady(defaults, overrides[member] ?? null)
	)
}
