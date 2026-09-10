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
	/**	Name : Data	*/
	name1?: string
	/**	Type : Select	*/
	item_type?: 'Built-in' | 'Web Page' | 'Route' | 'External'
	/**	Is Standard : Check	*/
	is_standard?: 0 | 1
	/**	Hidden : Check	*/
	hidden?: 0 | 1
	/**	Icon : Data	*/
	icon?: string
	/**	Web Page : Link - Web Page	*/
	web_page?: string
	/**	Route : Data	*/
	route?: string
	/**	URL : Data	*/
	url?: string
	/**	Open in new window : Check	*/
	open_in_new_window?: 0 | 1
	/**	Title : Data	*/
	title?: string
}
