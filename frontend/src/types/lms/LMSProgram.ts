import { LMSProgramCourse } from './LMSProgramCourse'
import { LMSProgramMember } from './LMSProgramMember'

export interface LMSProgram {
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
	/**	Program Courses : Table - LMS Program Course	*/
	program_courses?: LMSProgramCourse[]
	/**	Program Members : Table - LMS Program Member	*/
	program_members?: LMSProgramMember[]
	/**	Title : Data	*/
	title: string
	/**	Published : Check	*/
	published?: 0 | 1
	/**	Enforce Course Order : Check	*/
	enforce_course_order?: 0 | 1
	/**	Course Count : Int	*/
	course_count?: number
	/**	Member Count : Int	*/
	member_count?: number
}
