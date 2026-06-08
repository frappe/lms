export interface LMSGoogleMeetSettings {
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
	/**	Enabled : Check	*/
	enabled?: 0 | 1
	/**	Account Name : Data	*/
	account_name: string
	/**	Member : Link - User	*/
	member: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Member Image : Attach Image	*/
	member_image?: string
	/**	Google Calendar : Link - Google Calendar	*/
	google_calendar: string
}
