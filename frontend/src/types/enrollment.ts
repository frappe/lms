export type EnrollTargetDoctype = 'LMS Course' | 'LMS Batch'
export type PaidKind = 'course' | 'certificate' | 'batch'
export type EnrollStatus =
	| 'ready'
	| 'enrolled'
	| 'no_user'
	| 'disabled'
	| 'upgrade'
	| 'certificate_purchased'
export type EnrollStep = 'select' | 'review' | 'payments'

export interface LinkablePayment {
	name: string
	amount: number
	currency: string
	creation: string
}

export interface EnrollPreviewRow {
	member: string
	full_name: string | null
	user_image: string | null
	status: EnrollStatus
	linkable_payments: LinkablePayment[]
}

export interface EnrollPreview {
	rows: EnrollPreviewRow[]
	seats_left: number | null
	amount: number
	currency: string | null
}

export interface PaymentDefaults {
	amount: number | null
	currency: string | null
	source: string | null
}

export type PaymentChoice =
	| { mode: 'create' }
	| { mode: 'link'; payment: string | null }

export interface BulkEnrollError {
	member: string
	error: string
}

export interface BulkEnrollResult {
	added: string[]
	upgraded: string[]
	errors: BulkEnrollError[]
}

export interface EnrollTarget {
	doctype: EnrollTargetDoctype
	name: string
	paidKind: PaidKind | null
	priceLabel: string | null
}
