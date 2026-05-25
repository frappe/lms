export interface LMSQuizResult {
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
	/**	Question : Text	*/
	question?: string
	/**	Users Response : Small Text	*/
	answer?: string
	/**	Is Correct : Check	*/
	is_correct?: 0 | 1
	/**	Question Name : Link - LMS Question	*/
	question_name?: string
	/**	Marks : Int	*/
	marks?: number
	/**	Marks out of : Int	*/
	marks_out_of?: number
}
