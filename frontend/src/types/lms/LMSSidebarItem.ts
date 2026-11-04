export interface LMSSidebarItem {
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
	/**	Icon : Data	*/
	icon: string
	/**	Web Page : Link - Web Page	*/
	web_page: string
	/**	Route : Data	*/
	route?: string
	/**	Title : Data	*/
	title?: string
}
