export interface LMSCertificate {
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
	/**	Issue Date : Date	*/
	issue_date: string
	/**	Course : Link - LMS Course	*/
	course?: string
	/**	Expiry Date : Date	*/
	expiry_date?: string
	/**	Member : Link - User	*/
	member: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Batch : Link - LMS Batch	*/
	batch_name?: string
	/**	Publish on Participant Page : Check	*/
	published?: 0 | 1
	/**	Template : Link - Print Format	*/
	template: string
	/**	Course Title : Data	*/
	course_title?: string
	/**	Evaluator : Link - Course Evaluator	*/
	evaluator?: string
	/**	Evaluator Name : Data	*/
	evaluator_name?: string
	/**	Batch Title : Data	*/
	batch_title?: string
}
