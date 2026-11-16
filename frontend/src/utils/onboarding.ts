type OnboardingUser = {
	is_system_manager?: boolean
	is_moderator?: boolean
} | null

// The Getting started checklist is for whoever sets the site up: system
// managers and moderators alike. Every step in it is something a Moderator can
// do, and each user keeps their own progress.
export function seesOnboarding(user: OnboardingUser | undefined): boolean {
	return Boolean(user?.is_system_manager || user?.is_moderator)
}
