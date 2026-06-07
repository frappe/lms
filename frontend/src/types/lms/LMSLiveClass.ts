export interface LMSLiveClass {
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
	/**	Description : Text	*/
	description?: string
	/**	Date : Date	*/
	date: string
	/**	Duration : Int	*/
	duration: number
	/**	Timezone : Data	*/
	timezone: string
	/**	Host : Link - User	*/
	host: string
	/**	Start URL : Small Text	*/
	start_url?: string
	/**	Join URL : Small Text	*/
	join_url?: string
	/**	Password : Password	*/
	password?: string
	/**	Time : Time	*/
	time: string
	/**	Batch : Link - LMS Batch	*/
	batch_name?: string
	/**	Auto Recording : Select	*/
	auto_recording?: 'No Recording' | 'Local' | 'Cloud'
	/**	Event : Link - Event	*/
	event?: string
	/**	Conferencing Provider : Select	*/
	conferencing_provider?: 'Zoom' | 'Google Meet'
	/**	Zoom Account : Link - LMS Zoom Settings	*/
	zoom_account?: string
	/**	Google Meet Account : Link - LMS Google Meet Settings	*/
	google_meet_account?: string
	/**	Meeting ID : Data	*/
	meeting_id?: string
	/**	Attendees : Int	*/
	attendees?: number
	/**	UUID : Data	*/
	uuid?: string
}
