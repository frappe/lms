export interface LMSCouponItem {
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
	/**	Reference DocType : Select	*/
	reference_doctype: '' | 'LMS Course' | 'LMS Batch'
	/**	Reference Name : Dynamic Link - reference_doctype	*/
	reference_name: string
}
