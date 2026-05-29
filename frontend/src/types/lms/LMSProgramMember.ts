export interface LMSProgramMember {
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
	/**	Member : Link - User	*/
	member: string
	/**	Full Name : Data	*/
	full_name?: string
	/**	Progress : Int	*/
	progress?: number
}
