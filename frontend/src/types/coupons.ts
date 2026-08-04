import type { SettingsListResource } from '@/composables/useSettingsListResource'

export interface Coupon {
	name: string
	enabled: boolean
	code: string
	discount_type: 'Percentage' | 'Fixed Amount'
	percentage_discount?: number
	fixed_amount_discount?: number
	expires_on?: string
	description?: string
	usage_limit?: number
	redemptions_count: number
	applicable_items: ApplicableItem[]
}

export type ApplicableItem = {
	reference_doctype: 'LMS Course' | 'LMS Batch'
	reference_name: string
	name: string
	parent: string
	parenttype: 'LMS Coupon'
	parentfield: 'applicable_items'
}

/** The list resource behind Settings > Coupons. */
export type Coupons = SettingsListResource<Coupon>
