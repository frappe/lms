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

export type AddressField =
	| 'address_line1'
	| 'address_line2'
	| 'city'
	| 'state'
	| 'country'
	| 'pincode'
	| 'phone'

export type BillingAddress = Record<AddressField, string>

export interface PaymentDefaults {
	amount: number | null
	currency: string | null
	source: string | null
	address: BillingAddress
}

export type PaymentField =
	| 'amount'
	| 'currency'
	| 'source'
	| 'billing_name'
	| AddressField

/** A student's own payment values; null keeps the common value. An address replaces the common one whole. */
export interface PaymentOverride {
	amount: number | null
	currency: string | null
	source: string | null
	billing_name: string | null
	address: BillingAddress | null
}

/** One row of search_users_to_enroll. */
export interface StudentOption {
	value: string
	label: string
	description: string
	image: string | null
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
