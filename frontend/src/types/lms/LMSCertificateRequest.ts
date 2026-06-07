export interface LMSCertificateRequest {
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
	/**	Member : Link - User	*/
	member: string
	/**	Evaluator : Link - User	*/
	evaluator?: string
	/**	Date : Date	*/
	date: string
	/**	Day : Select	*/
	day?:
		| 'Sunday'
		| 'Monday'
		| 'Tuesday'
		| 'Wednesday'
		| 'Thursday'
		| 'Friday'
		| 'Saturday'
	/**	Start Time : Time	*/
	start_time: string
	/**	End Time : Time	*/
	end_time: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Google Meet Link : Data	*/
	google_meet_link?: string
	/**	Batch : Link - LMS Batch	*/
	batch_name?: string
	/**	Course Title : Data	*/
	course_title?: string
	/**	Evaluator Name : Data	*/
	evaluator_name?: string
	/**	Timezone : Data	*/
	timezone?: string
	/**	Batch Title : Data	*/
	batch_title?: string
	/**	Status : Select	*/
	status?: 'Upcoming' | 'Completed' | 'Cancelled'
}
