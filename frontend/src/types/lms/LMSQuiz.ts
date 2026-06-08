import { LMSQuizQuestion } from './LMSQuizQuestion'

export interface LMSQuiz {
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
	/**	Questions : Table - LMS Quiz Question	*/
	questions?: LMSQuizQuestion[]
	/**	Lesson : Link - Course Lesson	*/
	lesson?: string
	/**	Max Attempts : Int	*/
	max_attempts?: number
	/**	Course : Link - LMS Course	*/
	course?: string
	/**	Show Answers : Check	*/
	show_answers?: 0 | 1
	/**	Show Submission History : Check	*/
	show_submission_history?: 0 | 1
	/**	Passing Percentage : Int	*/
	passing_percentage: number
	/**	Total Marks : Int	*/
	total_marks: number
	/**	Shuffle Questions : Check	*/
	shuffle_questions?: 0 | 1
	/**	Limit Questions To : Int	*/
	limit_questions_to?: number
	/**	Duration (in minutes) : Data	*/
	duration?: string
	/**	Enable Negative Marking : Check	*/
	enable_negative_marking?: 0 | 1
	/**	Marks To Cut : Int	*/
	marks_to_cut?: number
}
