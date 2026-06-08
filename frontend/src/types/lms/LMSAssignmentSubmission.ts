export interface LMSAssignmentSubmission {
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
	/**	Lesson : Link - Course Lesson	*/
	lesson?: string
	/**	Assignment : Link - LMS Assignment	*/
	assignment: string
	/**	Member : Link - User	*/
	member: string
	/**	Member Name : Data	*/
	member_name?: string
	/**	Course : Link - LMS Course	*/
	course?: string
	/**	Status : Select	*/
	status?: 'Pass' | 'Fail' | 'Not Graded' | 'Not Applicable'
	/**	Comments : Text Editor	*/
	comments?: string
	/**	Evaluator : Link - User	*/
	evaluator?: string
	/**	Assignment Attachment : Attach	*/
	assignment_attachment?: string
	/**	Type : Select	*/
	type?: 'Document' | 'PDF' | 'URL' | 'Image' | 'Text'
	/**	Question : Text Editor	*/
	question?: string
	/**	Assignment Title : Data	*/
	assignment_title?: string
	/**	Answer : Text Editor	*/
	answer?: string
}
