import { EvaluatorSchedule } from './EvaluatorSchedule'

export interface CourseEvaluator {
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
	/**	Evaluator : Link - User	*/
	evaluator: string
	/**	Schedule : Table - Evaluator Schedule	*/
	schedule?: EvaluatorSchedule[]
	/**	From : Date	*/
	unavailable_from?: string
	/**	To : Date	*/
	unavailable_to?: string
	/**	Full Name : Data	*/
	full_name?: string
	/**	User Image : Attach Image	*/
	user_image?: string
	/**	Username : Data	*/
	username?: string
}
