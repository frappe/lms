export interface Certification {
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
	/**	Certification Name : Data	*/
	certification_name: string
	/**	Organization : Data	*/
	organization: string
	/**	Issue Date : Date	*/
	issue_date: string
	/**	Description : Small Text	*/
	description?: string
	/**	Expiration Date : Data	*/
	expiration_date?: string
	/**	This certificate does no expire : Check	*/
	expire?: 0 | 1
}
