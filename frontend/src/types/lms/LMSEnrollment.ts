export interface LMSEnrollment {
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
	/**	Member Type : Select	*/
	member_type?: '' | 'Student' | 'Mentor' | 'Staff'
	/**	Role : Select	*/
	role?: '' | 'Member' | 'Admin'
	/**	Member Name : Data	*/
	member_name?: string
	/**	Course : Link - LMS Course	*/
	course: string
	/**	Current Lesson : Link - Course Lesson	*/
	current_lesson?: string
	/**	Member Username : Data	*/
	member_username?: string
	/**	Progress : Float	*/
	progress?: number
	/**	Payment : Link - LMS Payment	*/
	payment?: string
	/**	Purchased Certificate : Check	*/
	purchased_certificate?: 0 | 1
	/**	Certificate : Link - LMS Certificate	*/
	certificate?: string
	/**	Member Image : Attach Image	*/
	member_image?: string
	/**	Enrollment from Batch : Link - LMS Batch	*/
	enrollment_from_batch?: string
}
