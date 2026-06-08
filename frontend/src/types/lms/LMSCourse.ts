import { ChapterReference } from './ChapterReference'
import { CourseInstructor } from './CourseInstructor'
import { RelatedCourses } from './RelatedCourses'

export interface LMSCourse {
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
	/**	Description : Text Editor	*/
	description: string
	/**	Published : Check	*/
	published?: 0 | 1
	/**	Video Embed Link : Data	*/
	video_link?: string
	/**	Short Introduction : Small Text	*/
	short_introduction: string
	/**	Disable Self Learning : Check	*/
	disable_self_learning?: 0 | 1
	/**	Preview Image : Attach Image	*/
	image?: string
	/**	Tags : Data	*/
	tags?: string
	/**	Upcoming : Check	*/
	upcoming?: 0 | 1
	/**	Chapters : Table - Chapter Reference	*/
	chapters?: ChapterReference[]
	/**	Instructors : Table MultiSelect - Course Instructor	*/
	instructors: CourseInstructor[]
	/**	Completion Certificate : Check	*/
	enable_certification?: 0 | 1
	/**	Related Courses : Table - Related Courses	*/
	related_courses?: RelatedCourses[]
	/**	Status : Select	*/
	status?: 'In Progress' | 'Under Review' | 'Approved'
	/**	Currency : Link - Currency	*/
	currency?: string
	/**	Paid Course : Check	*/
	paid_course?: 0 | 1
	/**	Amount : Currency	*/
	course_price?: number
	/**	Amount (USD) : Currency - If you set an amount here, then the USD equivalent setting will not get applied.	*/
	amount_usd?: number
	/**	Published On : Date	*/
	published_on?: string
	/**	Featured : Check	*/
	featured?: 0 | 1
	/**	Category : Link - LMS Category	*/
	category?: string
	/**	Enrollments : Int	*/
	enrollments?: number
	/**	Lessons : Int	*/
	lessons?: number
	/**	Rating : Data	*/
	rating?: string
	/**	Paid Certificate : Check	*/
	paid_certificate?: 0 | 1
	/**	Evaluator : Link - Course Evaluator	*/
	evaluator?: string
	/**	Color : Select	*/
	card_gradient?:
		| 'Red'
		| 'Blue'
		| 'Green'
		| 'Amber'
		| 'Cyan'
		| 'Orange'
		| 'Pink'
		| 'Purple'
		| 'Teal'
		| 'Violet'
		| 'Yellow'
		| 'Gray'
	/**	Timezone : Data	*/
	timezone?: string
	/**	Notification Sent : Check	*/
	notification_sent?: 0 | 1
}
