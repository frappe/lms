export interface LMSCourseProgress {
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
	course?: string
	/**	Chapter : Link - Course Chapter	*/
	chapter?: string
	/**	Lesson : Link - Course Lesson	*/
	lesson?: string
	/**	Status : Select	*/
	status?: 'Complete' | 'Partially Complete' | 'Incomplete'
	/**	Member : Link - User	*/
	member?: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Is SCORM Chapter : Check	*/
	is_scorm_chapter?: 0 | 1
	/**	SCORM Content : Long Text	*/
	scorm_content?: string
}
