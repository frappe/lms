export interface LMSZoomSettings {
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
	/**	Account ID : Data	*/
	account_id: string
	/**	Client ID : Data	*/
	client_id: string
	/**	Client Secret : Password	*/
	client_secret: string
	/**	Member : Link - User	*/
	member: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Account Name : Data	*/
	account_name: string
	/**	Member Image : Attach Image	*/
	member_image?: string
}
