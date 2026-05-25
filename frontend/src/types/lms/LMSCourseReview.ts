export interface LMSCourseReview {
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
	/**	Review : Small Text	*/
	review?: string
	/**	Rating : Rating	*/
	rating: number
	/**	Course : Link - LMS Course	*/
	course: string
}
