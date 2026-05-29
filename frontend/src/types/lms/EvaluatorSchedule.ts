export interface EvaluatorSchedule {
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
	/**	Day : Select	*/
	day:
		| 'Sunday'
		| 'Monday'
		| 'Tuesday'
		| 'Wednesday'
		| 'Thursday'
		| 'Friday'
		| 'Saturday'
	/**	Start Time : Time	*/
	start_time: string
	/**	End Time : Time	*/
	end_time: string
}
