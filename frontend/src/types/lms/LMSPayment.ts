export interface LMSPayment {
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
	/**	Order ID : Data	*/
	order_id?: string
	/**	Payment ID : Data	*/
	payment_id?: string
	/**	Amount : Currency	*/
	amount: number
	/**	Coupon : Link - LMS Coupon	*/
	coupon?: string
	/**	Discount Amount : Currency	*/
	discount_amount?: number
	/**	Currency : Link - Currency	*/
	currency: string
	/**	GSTIN : Data	*/
	gstin?: string
	/**	PAN : Data	*/
	pan?: string
	/**	Address : Link - Address	*/
	address: string
	/**	Payment Received : Check	*/
	payment_received?: 0 | 1
	/**	Billing Name : Data	*/
	billing_name: string
	/**	Member : Link - User	*/
	member: string
	/**	Payment for Document Type : Select	*/
	payment_for_document_type: '' | 'LMS Course' | 'LMS Batch'
	/**	Payment for Document : Dynamic Link - payment_for_document_type	*/
	payment_for_document: string
	/**	Source : Link - LMS Source	*/
	source: string
	/**	Payment for Certificate : Check	*/
	payment_for_certificate?: 0 | 1
	/**	Coupon Code : Data	*/
	coupon_code?: string
	/**	Amount with GST : Currency	*/
	amount_with_gst?: number
	/**	Original Amount : Currency	*/
	original_amount?: number
	/**	Member Consent : Check	*/
	member_consent?: 0 | 1
}
