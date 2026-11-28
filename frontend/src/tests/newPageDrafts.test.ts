import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const { call, toastError, updateMetaInfo } = vi.hoisted(() => ({
	call: vi.fn(),
	toastError: vi.fn(),
	updateMetaInfo: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	call,
	toast: { error: toastError, success: vi.fn() },
}))
vi.mock('@/utils', () => ({
	cleanError: (message?: string) => message,
	updateMetaInfo,
}))

String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}
vi.stubGlobal('__', (text: string) => text)

import {
	chaptersToCreate,
	useCourseDraft,
	type CourseDraft,
} from '@/composables/useCourseDraft'
import {
	batchInsertDoc,
	useBatchDraft,
	type BatchDraft,
} from '@/pages/Batches/composables/useBatchDraft'

function withSetup<T>(setup: () => T): T {
	let result!: T
	mount(
		defineComponent({
			setup() {
				result = setup()
				return () => h('div')
			},
		})
	)
	return result
}

const fillCourse = (form: CourseDraft) => {
	Object.assign(form.resource.doc!, {
		title: 'Intro to Frappe',
		short_introduction: 'Build apps',
		description: '<p>All of it</p>',
	})
}

const fillBatch = (form: BatchDraft) => {
	Object.assign(form.doc.value!, {
		title: 'Cohort 1',
		description: 'For new devs',
		batch_details: '<p>Weekly</p>',
		start_date: '2026-12-01',
		end_date: '2026-12-20',
		start_time: '10:00',
		end_time: '11:00',
	})
	form.instructors.value = ['me@x.com']
}

beforeEach(() => {
	call.mockReset()
	toastError.mockReset()
})

describe('a new course before its first save', () => {
	it('keeps only chapters with a title or a titled lesson', () => {
		expect(
			chaptersToCreate([
				{ title: ' Basics ', lessons: ['Setup', ' '] },
				{ title: '', lessons: [''] },
				{ title: '', lessons: ['Orphan'] },
			])
		).toEqual([
			{ title: 'Basics', lessons: ['Setup'] },
			{ title: '', lessons: ['Orphan'] },
		])
	})

	it('names what is missing and creates nothing', () => {
		const form = withSetup(() => useCourseDraft('me@x.com', vi.fn()))
		form.submitCourse()
		expect(call).not.toHaveBeenCalled()
		expect(form.showRequired.value).toBe(true)
		expect(form.isMissing('title')).toBe(true)
		expect(form.isMissing('instructors')).toBe(false)
	})

	it('creates the course with its rows, then its outline, then opens it', async () => {
		const onCreated = vi.fn()
		call.mockImplementation((method: string) =>
			Promise.resolve(
				method === 'lms.lms.api.upsert_chapter'
					? { name: 'CH-1' }
					: { name: 'intro-to-frappe' }
			)
		)
		const form = withSetup(() => useCourseDraft('me@x.com', onCreated))
		fillCourse(form)
		form.relatedCourses.value = ['other-course']
		form.draftChapters.value = [{ title: 'Basics', lessons: ['Setup'] }]
		form.submitCourse()
		await flushPromises()

		const [, insert] = call.mock.calls[0]
		expect(insert.doc).toMatchObject({
			doctype: 'LMS Course',
			title: 'Intro to Frappe',
			instructors: [{ instructor: 'me@x.com' }],
			related_courses: [{ course: 'other-course' }],
		})
		expect(call).toHaveBeenCalledWith('lms.lms.api.upsert_chapter', {
			course: 'intro-to-frappe',
			title: 'Basics',
		})
		expect(call).toHaveBeenCalledWith('lms.lms.api.create_lesson', {
			chapter: 'CH-1',
			title: 'Setup',
		})
		expect(onCreated).toHaveBeenCalledWith('intro-to-frappe')
	})

	it('still opens a created course when a chapter fails, so it is never created twice', async () => {
		const onCreated = vi.fn()
		call.mockImplementation((method: string) =>
			method === 'frappe.client.insert'
				? Promise.resolve({ name: 'intro-to-frappe' })
				: Promise.reject(new Error('nope'))
		)
		const form = withSetup(() => useCourseDraft('me@x.com', onCreated))
		fillCourse(form)
		form.draftChapters.value = [{ title: 'Basics', lessons: [] }]
		form.submitCourse()
		await flushPromises()
		expect(onCreated).toHaveBeenCalledWith('intro-to-frappe')
		expect(toastError).toHaveBeenCalledWith(
			'The course was created, but some chapters were not.'
		)
	})
	it('has edits once typed into, and none after it is created', async () => {
		call.mockResolvedValue({ name: 'intro-to-frappe' })
		const form = withSetup(() => useCourseDraft('me@x.com', vi.fn()))
		expect(form.hasEdits.value).toBe(false)
		fillCourse(form)
		expect(form.hasEdits.value).toBe(true)
		expect(await form.submitCourse()).toBe(true)
		expect(form.hasEdits.value).toBe(false)
	})

	it('reports a failed create so Save and leave stays', async () => {
		call.mockRejectedValue({ messages: ['Title taken'] })
		const form = withSetup(() => useCourseDraft('me@x.com', vi.fn()))
		fillCourse(form)
		expect(await form.submitCourse()).toBe(false)
		expect(form.hasEdits.value).toBe(true)
		expect(toastError).toHaveBeenCalledWith('Title taken')
	})
})

describe('a new batch before its first save', () => {
	it('sends its courses and assessments as rows of the one insert', () => {
		expect(
			batchInsertDoc(
				{ title: 'Cohort 1' },
				['me@x.com'],
				['course-a'],
				[
					{
						name: 'LMS Quiz::QZ-1',
						assessment_type: 'LMS Quiz',
						assessment_name: 'QZ-1',
						title: 'Quiz',
					},
				]
			)
		).toMatchObject({
			doctype: 'LMS Batch',
			title: 'Cohort 1',
			instructors: [{ instructor: 'me@x.com' }],
			courses: [{ course: 'course-a' }],
			assessment: [{ assessment_type: 'LMS Quiz', assessment_name: 'QZ-1' }],
		})
	})

	it('rings the gaps instead of saving', () => {
		const form = withSetup(() => useBatchDraft(vi.fn()))
		form.submitBatch()
		expect(call).not.toHaveBeenCalled()
		expect(form.isMissing('title')).toBe(true)
		expect(form.isMissing('timezone')).toBe(false)
	})

	it('creates the batch and opens it', async () => {
		const onCreated = vi.fn()
		call.mockResolvedValue({ name: 'cohort-1' })
		const form: BatchDraft = withSetup(() => useBatchDraft(onCreated))
		Object.assign(form.doc.value!, {
			title: 'Cohort 1',
			description: 'For new devs',
			batch_details: '<p>Weekly</p>',
			start_date: '2026-12-01',
			end_date: '2026-12-20',
			start_time: '10:00',
			end_time: '11:00',
		})
		form.instructors.value = ['me@x.com']
		form.draft.courses.value = ['course-a']
		form.submitBatch()
		await flushPromises()
		expect(call.mock.calls[0][1].doc.courses).toEqual([{ course: 'course-a' }])
		expect(onCreated).toHaveBeenCalledWith('cohort-1')
	})
	it('has edits once typed into, and none after it is created', async () => {
		call.mockResolvedValue({ name: 'cohort-1' })
		const form: BatchDraft = withSetup(() => useBatchDraft(vi.fn()))
		expect(form.hasEdits.value).toBe(false)
		fillBatch(form)
		expect(form.hasEdits.value).toBe(true)
		expect(await form.submitBatch()).toBe(true)
		expect(form.hasEdits.value).toBe(false)
	})

	it('saves the meta tags through the shared helper, which reports failures', async () => {
		call.mockResolvedValue({ name: 'cohort-1' })
		const form: BatchDraft = withSetup(() => useBatchDraft(vi.fn()))
		fillBatch(form)
		form.meta.description = 'For new devs'
		await form.submitBatch()
		expect(updateMetaInfo).toHaveBeenCalledWith(
			'batches',
			'cohort-1',
			form.meta
		)
	})

	it('counts a picked course as an edit', () => {
		const form: BatchDraft = withSetup(() => useBatchDraft(vi.fn()))
		form.draft.courses.value = ['course-a']
		expect(form.hasEdits.value).toBe(true)
	})

	it('reports a failed or incomplete create so Save and leave stays', async () => {
		const form: BatchDraft = withSetup(() => useBatchDraft(vi.fn()))
		expect(await form.submitBatch()).toBe(false)
		call.mockRejectedValue({ messages: ['Title taken'] })
		fillBatch(form)
		expect(await form.submitBatch()).toBe(false)
		expect(toastError).toHaveBeenCalledWith('Title taken')
		expect(form.hasEdits.value).toBe(true)
	})
})
