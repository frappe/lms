import { LMSQuizResult } from './LMSQuizResult'

export interface LMSQuizSubmission {
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
	/**	Quiz : Link - LMS Quiz	*/
	quiz?: string
	/**	Result : Table - LMS Quiz Result	*/
	result?: LMSQuizResult[]
	/**	Score : Int	*/
	score: number
	/**	Member : Link - User	*/
	member?: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Course : Link - LMS Course	*/
	course?: string
	/**	Score Out Of : Int	*/
	score_out_of: number
	/**	Percentage : Int	*/
	percentage: number
	/**	Passing Percentage : Int	*/
	passing_percentage: number
	/**	Quiz Title : Data	*/
	quiz_title?: string
}
