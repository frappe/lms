import { BatchCourse } from './BatchCourse'
import { CourseInstructor } from './CourseInstructor'
import { LMSAssessment } from './LMSAssessment'
import { LMSBatchTimetable } from './LMSBatchTimetable'
import { LMSTimetableLegend } from './LMSTimetableLegend'

export interface LMSBatch {
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
	/**	End Date : Date	*/
	end_date: string
	/**	Description : Small Text	*/
	description: string
	/**	Courses : Table - Batch Course	*/
	courses?: BatchCourse[]
	/**	Start Date : Date	*/
	start_date: string
	/**	Custom HTML : Code	*/
	custom_component?: string
	/**	Paid Batch : Check - Students will be enrolled in a paid batch once they complete the payment	*/
	paid_batch?: 0 | 1
	/**	Seat Count : Int	*/
	seat_count?: number
	/**	Start Time : Time	*/
	start_time: string
	/**	End Time : Time	*/
	end_time: string
	/**	Assessment : Table - LMS Assessment	*/
	assessment?: LMSAssessment[]
	/**	Medium : Select	*/
	medium?: 'Online' | 'Offline'
	/**	Category : Link - LMS Category	*/
	category?: string
	/**	Amount : Currency	*/
	amount?: number
	/**	Currency : Link - Currency	*/
	currency?: string
	/**	Batch Details : Text Editor	*/
	batch_details: string
	/**	Published : Check	*/
	published?: 0 | 1
	/**	Timetable : Table - LMS Batch Timetable	*/
	timetable?: LMSBatchTimetable[]
	/**	Timetable Template : Link - LMS Timetable Template	*/
	timetable_template?: string
	/**	Show live class : Check	*/
	show_live_class?: 0 | 1
	/**	Batch Details Raw : HTML Editor	*/
	batch_details_raw?: string
	/**	Meta Image : Attach Image	*/
	meta_image?: string
	/**	Custom Script (JavaScript) : Code	*/
	custom_script?: string
	/**	Timetable Legends : Table - LMS Timetable Legend	*/
	timetable_legends?: LMSTimetableLegend[]
	/**	Allow accessing future dates : Check	*/
	allow_future?: 0 | 1
	/**	Evaluation End Date : Date	*/
	evaluation_end_date?: string
	/**	Amount (USD) : Currency - If you set an amount here, then the USD equivalent setting will not get applied.	*/
	amount_usd?: number
	/**	Allow Self Enrollment : Check	*/
	allow_self_enrollment?: 0 | 1
	/**	Timezone : Data	*/
	timezone: string
	/**	Instructors : Table MultiSelect - Course Instructor	*/
	instructors: CourseInstructor[]
	/**	Confirmation Email Template : Link - Email Template	*/
	confirmation_email_template?: string
	/**	Certification : Check	*/
	certification?: 0 | 1
	/**	Conferencing Provider : Select	*/
	conferencing_provider?: '' | 'Zoom' | 'Google Meet'
	/**	Zoom Account : Link - LMS Zoom Settings	*/
	zoom_account?: string
	/**	Google Meet Account : Link - LMS Google Meet Settings	*/
	google_meet_account?: string
	/**	Preview Video : Attach	*/
	video_link?: string
	/**	Notification Sent : Check	*/
	notification_sent?: 0 | 1
	/**	Evaluation : Check	*/
	evaluation?: 0 | 1
}
