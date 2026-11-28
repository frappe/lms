import { computed } from 'vue'
import { createResource } from 'frappe-ui'
import type { PickerItem } from '@/components/InlineEdit/PickerDialog.vue'
import { courseIcon } from '@/utils/courseIcons'
import { courseTint } from '@/utils/courseTints'

export interface CourseRow {
	name: string
	title: string
	category?: string | null
	lessons?: number
	enrollments?: number
	rating?: string | number | null
	card_gradient?: string | null
	icon?: string | null
	image?: string | null
}

const compact = new Intl.NumberFormat(undefined, {
	notation: 'compact',
	maximumFractionDigits: 1,
})

const countLabel = (count: number | undefined, one: string, many: string) =>
	count == 1 ? __(one) : __(many).format(compact.format(count || 0))

const toItem = (
	course: CourseRow,
	suggestedCategory?: string | null
): PickerItem => ({
	value: course.name,
	title: course.title,
	meta: [
		course.category || '',
		countLabel(course.lessons, '1 lesson', '{0} lessons'),
		countLabel(course.enrollments, '1 learner', '{0} learners'),
	].filter(Boolean),
	rating: Number(course.rating)
		? Number(Number(course.rating).toFixed(1))
		: null,
	tint: courseTint(course.card_gradient),
	icon: courseIcon(course.icon),
	image: course.image,
	category: course.category,
	suggested:
		Boolean(suggestedCategory) && course.category === suggestedCategory,
})

/** Published courses as picker rows, with the given category suggested first. */
export function useCoursePickerItems(
	exclude: () => string[],
	suggestedCategory: () => string | null | undefined
) {
	const courses = createResource({
		url: 'lms.lms.utils.get_courses',
		makeParams: () => ({
			filters: { published: 1 },
			order_by: 'title asc',
			limit_page_length: 120,
		}),
	})

	const items = computed<PickerItem[]>(() =>
		((courses.data as CourseRow[] | null) || [])
			.filter((course) => !exclude().includes(course.name))
			.map((course) => toItem(course, suggestedCategory()))
	)

	const byName = computed<Record<string, CourseRow>>(() =>
		Object.fromEntries(
			((courses.data as CourseRow[] | null) || []).map((course) => [
				course.name,
				course,
			])
		)
	)

	const categories = computed<string[]>(
		() =>
			[
				...new Set(items.value.map((item) => item.category).filter(Boolean)),
			].sort() as string[]
	)

	const load = (): void => {
		if (!courses.data && !courses.loading) courses.fetch()
	}

	return { items, categories, byName, load }
}
