export interface LMSAssessment {
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
	/**	Assessment Type : Link - DocType	*/
	assessment_type: string
	/**	Assessment Name : Dynamic Link - assessment_type	*/
	assessment_name: string
}
