export interface LMSQuizQuestion {
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
	/**	Question : Link - LMS Question	*/
	question: string
	/**	Marks : Int	*/
	marks: number
	/**	Question Detail : Text	*/
	question_detail?: string
	/**	Type : Select	*/
	type?: 'Choices' | 'User Input' | 'Open Ended'
}
