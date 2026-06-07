import { LMSTestCaseSubmission } from './LMSTestCaseSubmission'

export interface LMSProgrammingExerciseSubmission {
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
	/**	Exercise : Link - LMS Programming Exercise	*/
	exercise: string
	/**	Member : Link - User	*/
	member: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Status : Select	*/
	status?: '' | 'Passed' | 'Failed'
	/**	Test Cases : Table - LMS Test Case Submission	*/
	test_cases?: LMSTestCaseSubmission[]
	/**	Code : Code	*/
	code: string
	/**	Exercise Title : Data	*/
	exercise_title?: string
	/**	Member Image : Attach	*/
	member_image?: string
}
