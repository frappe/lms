export interface LMSAssignment {
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
	/**	Question : Text Editor	*/
	question: string
	/**	Type : Select	*/
	type: 'Document' | 'PDF' | 'URL' | 'Image' | 'Text'
	/**	Title : Data	*/
	title: string
	/**	Show Answer : Check	*/
	show_answer?: 0 | 1
	/**	Answer : Text Editor	*/
	answer?: string
	/**	Grade Assignment : Check	*/
	grade_assignment?: 0 | 1
	/**	Course : Link - LMS Course	*/
	course?: string
}
