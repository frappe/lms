import { call, toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { computed, provide, reactive, ref, toRaw } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { CourseForm } from '@/composables/useCourseForm'
import { cleanError, updateMetaInfo } from '@/utils'
import { joinLabels, missingCourseFields } from '@/utils/courseForm'
import { shuffleThumbnail } from '@/utils/courseIcons'
import { sanitizeStringFields } from '@/utils/sanitizeOnWrite'
import type { CourseFormMeta, Resource } from '@/types'
import type { LMSCourse } from '@/types/lms/LMSCourse'

export interface DraftChapter {
	title: string
	lessons: string[]
}

export interface CourseDraft extends CourseForm {
	draftChapters: Ref<DraftChapter[]>
	/** Anything typed since the page opened, until the course is created. */
	hasEdits: ComputedRef<boolean>
}

const hasTitle = (title: string): boolean => Boolean(title.trim())

/** The chapters worth creating: a title or at least one titled lesson. */
export function chaptersToCreate(chapters: DraftChapter[]): DraftChapter[] {
	return chapters
		.map((chapter) => ({
			title: chapter.title.trim(),
			lessons: chapter.lessons.map((title) => title.trim()).filter(hasTitle),
		}))
		.filter((chapter) => chapter.title || chapter.lessons.length)
}

function blankCourse(): Partial<LMSCourse> {
	const thumbnail = shuffleThumbnail()
	return {
		title: '',
		short_introduction: '',
		description: '',
		category: undefined,
		image: undefined,
		card_gradient: thumbnail.color as LMSCourse['card_gradient'],
		icon: thumbnail.icon,
		published: 0,
		paid_course: 0,
		enable_certification: 0,
		paid_certificate: 0,
	}
}

async function createOutline(
	course: string,
	chapters: DraftChapter[]
): Promise<void> {
	for (const chapter of chaptersToCreate(chapters)) {
		const created = await call('lms.lms.api.upsert_chapter', {
			course,
			title: chapter.title || __('Untitled chapter'),
		})
		for (const title of chapter.lessons) {
			await call('lms.lms.api.create_lesson', { chapter: created.name, title })
		}
	}
}

/**
 * A course that exists only on the page until its first save. It offers the
 * same form the course overview edits, so the overview renders it unchanged.
 */
export function useCourseDraft(
	instructor: string | null,
	onCreated: (name: string) => void
): CourseDraft {
	const saving = ref<boolean>(false)
	const resource = reactive({
		doc: blankCourse(),
		setValue: { loading: saving },
	}) as unknown as Resource<LMSCourse | null>
	const instructors = ref<string[]>(instructor ? [instructor] : [])
	const relatedCourses = ref<string[]>([])
	const meta = reactive<CourseFormMeta>({ description: '', keywords: '' })
	const draftChapters = ref<DraftChapter[]>([{ title: '', lessons: [''] }])
	const showRequired = ref<boolean>(false)
	const created = ref<boolean>(false)

	const snapshot = (): string =>
		JSON.stringify([
			resource.doc,
			instructors.value,
			relatedCourses.value,
			meta,
			draftChapters.value,
		])
	const pristine = snapshot()
	const hasEdits = computed<boolean>(
		() => !created.value && snapshot() !== pristine
	)

	const missingFields = computed(() =>
		missingCourseFields({
			doc: resource.doc ?? null,
			instructors: instructors.value,
		})
	)
	const isMissing = (key: string): boolean =>
		showRequired.value && missingFields.value.some((f) => f.key === key)

	async function create(): Promise<void> {
		const fields = { ...toRaw(resource.doc) } as Record<string, unknown>
		sanitizeStringFields(fields)
		const course = await call('frappe.client.insert', {
			doc: {
				...fields,
				doctype: 'LMS Course',
				instructors: instructors.value.map((name) => ({ instructor: name })),
				related_courses: relatedCourses.value.map((name) => ({ course: name })),
			},
		})
		if (meta.description || meta.keywords) {
			updateMetaInfo('courses', course.name, meta)
		}
		// The course exists now: a failed chapter must not keep the draft open,
		// or saving again would create the course twice.
		await createOutline(course.name, draftChapters.value).catch(() =>
			toast.error(__('The course was created, but some chapters were not.'))
		)
		created.value = true
		onCreated(course.name)
	}

	async function submitCourse(): Promise<boolean> {
		if (saving.value) return false
		if (missingFields.value.length) {
			showRequired.value = true
			toast.error(
				__('Add {0} before saving.').format(
					joinLabels(missingFields.value.map((f) => f.label))
				)
			)
			return false
		}
		saving.value = true
		try {
			await create()
			return true
		} catch (error) {
			toast.error(
				cleanError((error as FrappeResourceError).messages?.[0]) ||
					__('Could not create the course')
			)
			return false
		} finally {
			saving.value = false
		}
	}

	const form: CourseDraft = {
		resource,
		instructors,
		relatedCourses,
		meta,
		markDirty: () => {},
		isDirty: ref(true),
		showRequired,
		missingFields,
		isMissing,
		isSaving: () => saving.value,
		submitCourse,
		draftChapters,
		hasEdits,
	}
	provide('courseForm', form)
	return form
}
