/**
 * Another user's profile arrives without `name`: a User's name is their login
 * email, and only staff are sent it. The profile tabs have to key on username.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { isInstructorOf } from '@/utils/instructors'

const { resources } = vi.hoisted(() => ({ resources: { value: [] as any[] } }))

vi.mock('frappe-ui', () => ({
	createResource: (config: any) => {
		const res: any = { config, data: [], reload: vi.fn() }
		resources.value.push(res)
		return res
	},
	HoverCard: { template: '<div><slot name="trigger" /><slot /></div>' },
	Button: { template: '<button><slot /></button>' },
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ branding: { data: { app_name: 'LMS' } } }),
}))

vi.mock('@/utils', () => ({ decodeEntities: (s: string) => s }))

const PROFILE = { data: { username: 'ola', full_name: 'Ola Other' } }

const findResource = (url: string) =>
	resources.value.find((r) => r.config.url === url)

const mountPage = async (load: () => Promise<{ default: any }>) =>
	mount((await load()).default, {
		props: { profile: PROFILE },
		global: {
			provide: {
				$user: { data: { name: 'me@example.com', username: 'me' } },
				$dayjs: () => ({ format: () => '' }),
			},
			mocks: { __: (s: string) => s },
			directives: { external: {} },
		},
	})

describe('profile tabs without the email', () => {
	beforeEach(() => {
		vi.stubGlobal('__', (s: string) => s)
		resources.value = []
	})

	it('loads certificates by username', async () => {
		await mountPage(
			// @ts-expect-error a JS SFC has no generated types (TS7016), as in announcementForm.test.ts.
			() => import('@/pages/ProfileCertificates.vue')
		)
		await flushPromises()
		const certificates = findResource('lms.lms.api.get_user_certificates')
		expect(certificates.config.params).toEqual({ username: 'ola' })
		expect(certificates.reload).toHaveBeenCalled()
	})

	it('loads badges by username', async () => {
		await mountPage(
			// @ts-expect-error a JS SFC has no generated types (TS7016), as in announcementForm.test.ts.
			() => import('@/pages/ProfileAbout.vue')
		)
		const badges = findResource('lms.lms.api.get_badges')
		expect(badges.config.params).toEqual({ member: 'ola' })
	})
})

describe('isInstructorOf', () => {
	const instructors = [{ username: 'ivy', full_name: 'Ivy' }]

	it('matches an instructor on username', () => {
		expect(isInstructorOf(instructors, 'ivy')).toBe(true)
		expect(isInstructorOf(instructors, 'sam')).toBe(false)
	})

	it('never matches a missing username', () => {
		expect(isInstructorOf([{ full_name: 'No Username' }], undefined)).toBe(
			false
		)
		expect(isInstructorOf([{ username: '' }], '')).toBe(false)
	})

	it('treats no instructor list as no match', () => {
		expect(isInstructorOf(undefined, 'ivy')).toBe(false)
		expect(isInstructorOf(null, 'ivy')).toBe(false)
	})
})
