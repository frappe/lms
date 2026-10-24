import type { DoctypePermissionType, SessionUser } from '@/types'

// Reads the doctype-level answers get_user_info carries for its fixed
// PERMISSION_DOCTYPES allowlist. A doctype outside that list reads as denied.
export const hasDoctypePermission = (
	user: SessionUser | undefined,
	doctype: string,
	ptype: DoctypePermissionType = 'read'
): boolean => Boolean(user?.data?.permissions?.[doctype]?.[ptype])

// Someone signed in without an LMS role is treated as a guest, so the LMS roles'
// DocPerms say nothing about what they may see. get_user_info decides who has one.
export const hasLmsRole = (user: SessionUser | undefined): boolean =>
	Boolean(user?.data?.has_lms_role)

export const canReadDiscussions = (user: SessionUser | undefined): boolean =>
	hasDoctypePermission(user, 'Discussion Topic') &&
	hasDoctypePermission(user, 'Discussion Reply')
