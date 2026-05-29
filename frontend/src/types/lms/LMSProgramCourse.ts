export interface LMSProgramCourse {
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
	/**	Course : Link - LMS Course	*/
	course: string
	/**	Course Title : Data	*/
	course_title?: string
}
