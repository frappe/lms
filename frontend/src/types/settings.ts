import type { SettingsListResource } from '@/composables/useSettingsListResource'

export interface User {
	data: {
		email: string
		name: string
		enabled: boolean
		user_image: string
		full_name: string
		user_type: ['System User', 'Website User']
		username: string
		is_moderator: boolean
		is_system_manager: boolean
		is_evaluator: boolean
		is_instructor: boolean
		is_fc_site: boolean
	}
}

export interface Badge {
	name: string
	title: string
	enabled: boolean
	description: string
	image: string
	grant_only_once: boolean
	event: string
	reference_doctype: string
	condition: string
	user_field: string
	field_to_check: string
}

/** The list resource behind Settings > Badges. */
export type Badges = SettingsListResource<Badge>

export interface BadgeAssignment {
	name: string
	member: string
	member_name: string
	member_username: string
	member_image: string
	badge: string
	issued_on: string
}

/** The list resource behind a badge's assignments. */
export type BadgeAssignments = SettingsListResource<BadgeAssignment>
