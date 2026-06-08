export interface LMSJobApplication {
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
	/**	User : Link - User	*/
	user: string
	/**	Resume : Attach	*/
	resume: string
	/**	Job : Link - Job Opportunity	*/
	job: string
	/**	Job Title : Data	*/
	job_title?: string
	/**	Company : Data	*/
	company?: string
}
