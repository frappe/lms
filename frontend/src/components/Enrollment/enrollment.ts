import type {
	BulkEnrollError,
	BulkEnrollResult,
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
	PaidKind,
	PaymentChoice,
	PaymentDefaults,
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

export const paidSwitchLabel = (kind: PaidKind): string => {
	if (kind === 'course') return __('Students have paid for this course')
	if (kind === 'certificate')
		return __('Students have purchased the certificate')
	return __('Students have paid for this batch')
}

export const priceHint = (kind: PaidKind, price: string): string => {
	if (kind === 'course') return __('Course price {0}', [price])
	if (kind === 'certificate') return __('Certificate price {0}', [price])
	return __('Batch price {0}', [price])
}

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

const createsPayments = (
	members: readonly string[],
	choices: Readonly<Record<string, PaymentChoice>>
): boolean => members.some((member) => choices[member]?.mode !== 'link')

export const buildSubmitParams = (
	target: EnrollTarget,
	members: readonly string[],
	paid: boolean,
	defaults: PaymentDefaults,
	choices: Readonly<Record<string, PaymentChoice>>
): Record<string, string | boolean> => {
	const params: Record<string, string | boolean> =
		target.doctype === 'LMS Course'
			? {
					course: target.name,
					members: JSON.stringify(members),
					purchased_certificate: paid && target.paidKind === 'certificate',
			  }
			: { batch: target.name, members: JSON.stringify(members) }
	if (!paid) return params

	const linked: Record<string, string> = {}
	for (const member of members) {
		const choice = choices[member]
		if (choice?.mode === 'link' && choice.payment) {
			linked[member] = choice.payment
		}
	}
	if (createsPayments(members, choices)) {
		params.payment_details = JSON.stringify({
			amount: defaults.amount,
			currency: defaults.currency,
			source: defaults.source,
		})
	}
	params.linked_payments = JSON.stringify(linked)
	return params
}

export const canSubmitPayments = (
	defaults: PaymentDefaults,
	members: readonly string[],
	choices: Readonly<Record<string, PaymentChoice>>
): boolean => {
	const linksReady = members.every((member) => {
		const choice = choices[member]
		return choice?.mode !== 'link' || !!choice.payment
	})
	if (!createsPayments(members, choices)) return linksReady
	const { amount, currency, source } = defaults
	if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
		return false
	return !!currency && !!source && linksReady
}
