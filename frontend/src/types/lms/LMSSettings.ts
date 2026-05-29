import { LMSSidebarItem } from './LMSSidebarItem'
import { PaymentCountry } from './PaymentCountry'

export interface LMSSettings {
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
	/**	LiveCode URL : Data	*/
	livecode_url?: string
	/**	Mentor Request Creation Template : Link - Email Template	*/
	mentor_request_creation?: string
	/**	Mentor Request Status Update Template : Link - Email Template	*/
	mentor_request_status_update?: string
	/**	Identify User Category : Check	*/
	user_category?: 0 | 1
	/**	Make LMS the default home : Check	*/
	default_home?: 0 | 1
	/**	Send calendar invite for evaluations : Check	*/
	send_calendar_invite_for_evaluations?: 0 | 1
	/**	Default Currency : Link - Currency	*/
	default_currency?: string
	/**	Apply GST for India : Check	*/
	apply_gst?: 0 | 1
	/**	Show USD Equivalent : Check	*/
	show_usd_equivalent?: 0 | 1
	/**	Primary Countries : Table MultiSelect - Payment Country	*/
	exception_country?: PaymentCountry[]
	/**	Apply Rounding on Equivalent : Check	*/
	apply_rounding?: 0 | 1
	/**	Batch Confirmation Template : Link - Email Template	*/
	batch_confirmation_template?: string
	/**	Courses : Check	*/
	show_courses?: 0 | 1
	/**	Students : Check	*/
	show_students?: 0 | 1
	/**	Assessments : Check	*/
	show_assessments?: 0 | 1
	/**	Live Class : Check	*/
	show_live_class?: 0 | 1
	/**	Discussions : Check	*/
	show_discussions?: 0 | 1
	/**	Emails : Check	*/
	show_emails?: 0 | 1
	/**	Dashboard : Check	*/
	show_dashboard?: 0 | 1
	/**	Certificate Email Template : Link - Email Template	*/
	certification_template?: string
	/**	Show day view in timetable : Check	*/
	show_day_view?: 0 | 1
	/**	Unsplash Access Key : Data	*/
	unsplash_access_key?: string
	/**	Courses : Check	*/
	courses?: 0 | 1
	/**	Batches : Check	*/
	batches?: 0 | 1
	/**	Jobs : Check	*/
	jobs?: 0 | 1
	/**	Statistics : Check	*/
	statistics?: 0 | 1
	/**	Notifications : Check	*/
	notifications?: 0 | 1
	/**	Sidebar Items : Table - LMS Sidebar Item	*/
	sidebar_items?: LMSSidebarItem[]
	/**	Custom Signup Content : HTML Editor	*/
	custom_signup_content?: string
	/**	Payment Gateway : Data	*/
	payment_gateway?: string
	/**	Allow Guest Access : Check	*/
	allow_guest_access?: 0 | 1
	/**	Payment Reminder Template : Link - Email Template	*/
	payment_reminder_template?: string
	/**	Disable Signup : Check	*/
	disable_signup?: 0 | 1
	/**	Meta Description : Small Text - This description will be shown on lists and pages without meta description	*/
	meta_description?: string
	/**	Meta Image : Attach Image - This image will be shown on lists and pages that don't have an image by default	*/
	meta_image?: string
	/**	Meta Keywords : Small Text - Common keywords that will be used for all pages	*/
	meta_keywords?: string
	/**	Persona Captured : Check	*/
	persona_captured?: 0 | 1
	/**	Certified Members : Check	*/
	certified_members?: 0 | 1
	/**	Prevent Skipping Videos : Check	*/
	prevent_skipping_videos?: 0 | 1
	/**	Programming Exercises : Check	*/
	programming_exercises?: 0 | 1
	/**	Contact Us Email : Data	*/
	contact_us_email?: string
	/**	Contact Us URL : Data	*/
	contact_us_url?: string
	/**	Certifications : Check	*/
	certifications?: 0 | 1
	/**	Disable PWA : Check	*/
	disable_pwa?: 0 | 1
	/**	Send Notification for Published Courses : Select	*/
	send_notification_for_published_courses?: '' | 'Email' | 'In-app'
	/**	Send Notification for Published Batches : Select	*/
	send_notification_for_published_batches?: '' | 'Email' | 'In-app'
	/**	Allow Job Posting : Check	*/
	allow_job_posting?: 0 | 1
	/**	Demo Data Present : Check	*/
	demo_data_present?: 0 | 1
	/**	Send Payment Reminders for Batch : Check	*/
	send_payment_reminders_for_batch?: 0 | 1
	/**	Send Payment Reminders for Course : Check	*/
	send_payment_reminders_for_course?: 0 | 1
}
