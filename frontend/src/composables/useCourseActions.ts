import { createResource, toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { getCurrentInstance, inject } from 'vue'
import type { InjectionKey } from 'vue'
import { useRouter } from 'vue-router'
import { useTelemetry } from '@framework/ui/telemetry/index'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import { exportCourseAsZip } from '@/utils/exportCourse'
import { resourceErrorMessage } from '@/utils/resource'
import { seesOnboarding } from '@/utils/onboarding'
import type { CourseDetails, Resource, SessionUser } from '@/types'

interface DialogAction {
	label: string
	theme?: string
	variant?: string
	onClick: (context: { close: () => void }) => void | Promise<unknown>
}
type DialogFn = (options: {
	title: string
	message: string
	actions: DialogAction[]
}) => void

type PublishResponse = {
	__onload?: { quizzes_without_questions?: string[] }
}

export interface CourseActions {
	publish: Resource<unknown>
	togglePublish: () => void
	exportCourse: () => void
	deleteCourse: () => void
}

export const COURSE_ACTIONS: InjectionKey<CourseActions> =
	Symbol('courseActions')

/** Publish, export and delete: shared by the header menu and the Options tab. */
export function useCourseActions(
	course: Resource<CourseDetails | null>
): CourseActions {
	const router = useRouter()
	const { capture } = useTelemetry()
	const onboarding = useOnboarding('learning')
	const user = inject<SessionUser>('$user')!
	const { $dialog } = getCurrentInstance()!.appContext.config
		.globalProperties as { $dialog: DialogFn }

	const publish = createResource({
		url: 'frappe.client.set_value',
		makeParams: () => ({
			doctype: 'LMS Course',
			name: course.data?.name,
			fieldname: 'published',
			value: course.data?.published ? 0 : 1,
		}),
		onSuccess(data: PublishResponse) {
			const published = !course.data?.published
			capture(published ? 'course_published' : 'course_unpublished', {
				course: course.data?.name,
			})
			if (published && seesOnboarding(user.data))
				onboarding?.updateOnboardingStep('publish_first_course')
			toast.success(
				published ? __('Course published') : __('Course unpublished')
			)
			warnEmptyQuizzes(data?.__onload?.quizzes_without_questions)
			course.reload()
		},
		onError(error: FrappeResourceError) {
			toast.error(error.messages?.[0] ?? __('Could not update publish status'))
		},
	}) as Resource<unknown>

	const remove = createResource({
		url: 'lms.lms.api.delete_course',
		makeParams: () => ({ course: course.data?.name }),
		onSuccess() {
			toast.success(__('Course deleted successfully'))
			router.push({ name: 'Courses', query: { tab: 'created' } })
		},
		onError(error: FrappeResourceError) {
			toast.error(resourceErrorMessage(error, __('Error')))
		},
	}) as Resource<unknown>

	function deleteCourse(): void {
		$dialog({
			title: __('Delete course'),
			message: __(
				'Deleting the course also deletes its chapters, lessons and learner progress. This cannot be undone.'
			),
			actions: [
				{
					label: __('Delete'),
					theme: 'red',
					variant: 'solid',
					onClick({ close }) {
						return remove.submit().finally(close)
					},
				},
			],
		})
	}

	return {
		publish,
		togglePublish: () => {
			if (!publish.loading) publish.submit()
		},
		exportCourse: () => exportCourseAsZip(course.data?.name),
		deleteCourse,
	}
}

function warnEmptyQuizzes(quizzes: string[] | undefined): void {
	if (!quizzes?.length) return
	toast.warning(
		__('These quizzes have no questions, so learners skip them: {0}').format(
			quizzes.join(', ')
		)
	)
}
