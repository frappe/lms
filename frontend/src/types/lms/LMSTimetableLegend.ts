export interface LMSTimetableLegend {
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
	/**	Reference DocType : Link - DocType	*/
	reference_doctype: string
	/**	Color : Color	*/
	color: string
	/**	Label : Data	*/
	label: string
}
