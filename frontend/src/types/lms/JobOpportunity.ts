export interface JobOpportunity {
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
	/**	Job Title : Data	*/
	job_title: string
	/**	City : Data	*/
	location: string
	/**	Type : Select	*/
	type: 'Full Time' | 'Part Time' | 'Freelance' | 'Contract'
	/**	Status : Select	*/
	status?: 'Open' | 'Closed'
	/**	Description : Text Editor	*/
	description: string
	/**	Company Name : Data	*/
	company_name: string
	/**	Company Website : Data	*/
	company_website: string
	/**	Company Logo : Attach Image	*/
	company_logo: string
	/**	Company Email Address : Data	*/
	company_email_address: string
	/**	Country : Link - Country	*/
	country: string
	/**	Work Mode : Select	*/
	work_mode?: '' | 'Remote' | 'Hybrid' | 'On-site'
}
