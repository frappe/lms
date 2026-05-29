export interface LMSTestCaseSubmission {
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
	/**	Input : Data	*/
	input?: string
	/**	Expected Output : Data	*/
	expected_output: string
	/**	Output : Data	*/
	output: string
	/**	Status : Select	*/
	status: 'Passed' | 'Failed'
}
