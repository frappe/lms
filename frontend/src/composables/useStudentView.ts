import {
	computed,
	inject,
	provide,
	type ComputedRef,
	type InjectionKey,
	type Ref,
} from 'vue'

/**
 * Student View shows a lesson as a learner sees it, but every component below
 * it still injected the real `$user`, whose `is_moderator` / `is_instructor` /
 * `is_evaluator` flags stay true. So the preview kept rendering instructor
 * affordances — most visibly Assignment.vue's Grading panel, which let a
 * moderator submit the assignment in preview and then grade themselves.
 *
 * `$user` is provided app-wide in main.js and read via `inject('$user')`
 * everywhere, so providing a mocked one at the preview boundary shadows it for
 * the whole subtree without touching a single consumer.
 *
 * This is presentation fidelity, not a security boundary: the session keeps all
 * its real server-side permissions. Backend impersonation would be a genuine
 * privilege-escalation surface for no user benefit.
 */
export const IS_STUDENT_VIEW: InjectionKey<
	Ref<boolean> | ComputedRef<boolean>
> = Symbol('isStudentView')

const INSTRUCTOR_FLAGS = [
	'is_moderator',
	'is_instructor',
	'is_evaluator',
	'is_system_manager',
] as const

const INSTRUCTOR_ROLES = [
	'Moderator',
	'Course Creator',
	'Batch Evaluator',
	'System Manager',
]

type UserResource = {
	data?: Record<string, unknown> | null
	reload?: () => unknown
	[key: string]: unknown
}

/** The real user with every instructor signal stripped out. */
export function asStudent(data: Record<string, unknown> | null | undefined) {
	if (!data) return data

	const roles = Array.isArray(data.roles) ? data.roles : undefined

	return {
		...data,
		...Object.fromEntries(INSTRUCTOR_FLAGS.map((flag) => [flag, false])),
		is_student: true,
		...(roles
			? {
					roles: roles.filter(
						(role) => !INSTRUCTOR_ROLES.includes(role as string)
					),
			  }
			: {}),
	}
}

/**
 * Shadow `$user` for this subtree with a student-shaped view of the real user.
 *
 * `active` is a getter rather than a boolean so leaving Student View restores
 * the real flags reactively, without remounting the preview.
 */
export function provideStudentView(user: UserResource, active: () => boolean) {
	const isStudentView = computed(() => Boolean(active()))

	const mockedUser = new Proxy(user, {
		get(target, key, receiver) {
			if (key === 'data' && isStudentView.value) {
				return asStudent(target.data)
			}
			return Reflect.get(target, key, receiver)
		},
	})

	provide('$user', mockedUser)
	provide(IS_STUDENT_VIEW, isStudentView)

	return { isStudentView, mockedUser }
}

/** For the few places that need the flag itself rather than the mocked user. */
export function useStudentView(): Ref<boolean> | ComputedRef<boolean> {
	return inject(
		IS_STUDENT_VIEW,
		computed(() => false)
	)
}
