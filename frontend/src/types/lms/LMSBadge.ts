export interface LMSBadge {
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
	/**	Title : Data	*/
	title: string
	/**	Image : Attach Image	*/
	image: string
	/**	Reference Document Type : Link - DocType	*/
	reference_doctype: string
	/**	Event : Select	*/
	event: 'New' | 'Value Change' | 'Manual Assignment'
	/**	Condition : Code	*/
	condition: string
	/**	Field To Check : Select	*/
	field_to_check?: string
	/**	Grant only once : Check	*/
	grant_only_once?: 0 | 1
	/**	Enabled : Check	*/
	enabled?: 0 | 1
	/**	Description : Small Text	*/
	description: string
	/**	User Field : Select	*/
	user_field: string
}
