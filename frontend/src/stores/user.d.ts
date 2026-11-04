import type { Resource, SessionUser } from '@/types'

export declare function usersStore(): {
	userResource: Resource<SessionUser['data'] | null>
	allUsers: Resource<Record<string, unknown> | null>
}
