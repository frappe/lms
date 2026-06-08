import { LMSTestCase } from './LMSTestCase'

export interface LMSProgrammingExercise {
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
	/**	Title : Data	*/
	title: string
	/**	Problem Statement : Text Editor	*/
	problem_statement: string
	/**	Language : Select	*/
	language: 'Python' | 'JavaScript' | 'Rust' | 'Go'
	/**	Test Cases : Table - LMS Test Case	*/
	test_cases?: LMSTestCase[]
}
