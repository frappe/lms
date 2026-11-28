/**
 * A guest heading to a page that needs an account logs in first and comes
 * back to that page, instead of landing on a login prompt or the course list.
 */
import { describe, expect, it, vi } from 'vitest'

const redirectToLogin = vi.fn()
vi.mock('@/utils/login', () => ({ redirectToLogin }))

const session = { isLoggedIn: false }
const settingsData = { allow_guest_access: true }

vi.mock('@/stores/session', () => ({ sessionStore: () => session }))
vi.mock('@/stores/user', () => ({
	usersStore: () => ({
		userResource: { promise: Promise.resolve(), data: { name: 'a@b.c' } },
	}),
}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: {
			promise: Promise.resolve(),
			data: settingsData,
		},
	}),
}))
vi.mock('frappe-ui', () => ({ call: vi.fn(async () => ({})) }))

const { guardNavigation } = await import('@/router')
const { routes } = await import('@/routes')

const billing = {
	name: 'Billing',
	path: '/billing/course/intro',
	fullPath: '/billing/course/intro?ref=card',
	meta: { requiresLogin: true },
}
const course = {
	name: 'CourseDetail',
	path: '/courses/intro',
	fullPath: '/courses/intro',
	meta: {},
}

describe('pages that need a login', () => {
	it('sends a guest to log in, then back to the checkout', async () => {
		session.isLoggedIn = false
		const next = vi.fn()
		await guardNavigation(billing, course, next)
		expect(next).toHaveBeenCalledWith(false)
		expect(redirectToLogin).toHaveBeenCalledWith(
			'/lms/billing/course/intro?ref=card'
		)
	})

	it('lets a logged-in learner straight through', async () => {
		session.isLoggedIn = true
		const next = vi.fn()
		await guardNavigation(billing, course, next)
		expect(next).toHaveBeenCalledWith()
	})

	it('still lets a guest browse a course', async () => {
		session.isLoggedIn = false
		const next = vi.fn()
		await guardNavigation(course, { ...course, name: 'Courses' }, next)
		expect(next).toHaveBeenCalledWith()
	})

	it('brings a guest back to the page they wanted when guests may not browse', async () => {
		session.isLoggedIn = false
		settingsData.allow_guest_access = false
		const next = vi.fn()
		await guardNavigation(course, { ...course, name: 'Courses' }, next)
		settingsData.allow_guest_access = true
		expect(next).toHaveBeenCalledWith(false)
		expect(redirectToLogin).toHaveBeenLastCalledWith('/lms/courses/intro')
	})

	it.each([
		'Billing',
		'Programs',
		'QuizPage',
		'AssignmentSubmission',
		'CertifiedParticipants',
	])('marks %s as needing a login', (name) => {
		expect(routes.find((r) => r.name === name)?.meta?.requiresLogin).toBe(true)
	})
})
