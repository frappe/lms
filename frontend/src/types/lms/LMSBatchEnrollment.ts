export interface LMSBatchEnrollment {
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
	/**	Member Name : Data	*/
	member_name?: string
	/**	Member Username : Data	*/
	member_username?: string
	/**	Payment : Link - LMS Payment	*/
	payment?: string
	/**	Source : Link - LMS Source	*/
	source?: string
	/**	Confirmation Email Sent : Check	*/
	confirmation_email_sent?: 0 | 1
	/**	Batch : Link - LMS Batch	*/
	batch: string
	/**	Member Image : Attach Image	*/
	member_image?: string
}
