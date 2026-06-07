export interface LMSBatchTimetable {
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
	reference_doctype?: string
	/**	Reference DocName : Dynamic Link - reference_doctype	*/
	reference_docname?: string
	/**	Date : Date	*/
	date?: string
	/**	Start Time : Time	*/
	start_time?: string
	/**	Duration : Data	*/
	duration?: string
	/**	End Time : Time	*/
	end_time?: string
	/**	Day : Int	*/
	day?: number
	/**	Milestone : Check	*/
	milestone?: 0 | 1
}
