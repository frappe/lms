import { createResource } from 'frappe-ui'
import { toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { AssessmentAuthorsInfo, AssessmentDoctype } from '@/types'

export type AssessmentAuthorsResource = ReturnType<
	typeof createResource<AssessmentAuthorsInfo>
>

/**
 * An assessment's authors via an endpoint, since a reviewer may not read User.
 * No name, no fetch.
 */
export function useAssessmentAuthors(
	doctype: AssessmentDoctype,
	name: MaybeRefOrGetter<string | null>
): AssessmentAuthorsResource {
	const resource = createResource<AssessmentAuthorsInfo>({
		url: 'lms.lms.api.get_assessment_authors',
		makeParams: () => ({ doctype, name: toValue(name) }),
	})

	watch(
		() => toValue(name),
		(value) => {
			resource.data = null
			if (value) resource.reload()
		},
		{ immediate: true }
	)

	return resource
}
