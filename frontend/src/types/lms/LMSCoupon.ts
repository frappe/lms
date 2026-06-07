import { LMSCouponItem } from './LMSCouponItem'

export interface LMSCoupon {
	creation: string
	name: string
	modified: string
	owner: string
	modified_by: string
	docstatus: 0 | 1 | 2
	parent?: string
	parentfield?: string
	parenttype?: string
	idx?: number
	/**	Code : Data	*/
	code: string
	/**	Discount Type : Select	*/
	discount_type: 'Percentage' | 'Fixed Amount'
	/**	Expires On : Date	*/
	expires_on?: string
	/**	Usage Limit : Int	*/
	usage_limit?: number
	/**	Applicable Items : Table - LMS Coupon Item	*/
	applicable_items: LMSCouponItem[]
	/**	Enabled : Check	*/
	enabled?: 0 | 1
	/**	Percentage Discount : Int	*/
	percentage_discount?: number
	/**	Fixed Amount Discount : Int	*/
	fixed_amount_discount?: number
	/**	Redemption Count : Int	*/
	redemption_count?: number
}
