/**
 * The LMS page of each LMS record, shared by the command palette and the links
 * in Flow's chat, and the Flow skill that tells the model the same paths.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/routes'
import {
	doctypeSlug,
	getDoctypeFromSlug,
	getListRoute,
	getRecordRoute,
	getRecordRouteFields,
} from '@/utils/recordRoutes'

const router = createRouter({ history: createMemoryHistory(), routes })

const SKILL = readFileSync(
	resolve(__dirname, '../../../skills/learning-pages/SKILL.md'),
	'utf8'
)

/** The skill's "Where each record opens" rows: doctype and its first link. */
const skillLinks = (): [string, string][] => {
	const section = SKILL.split('## Where each record opens')[1].split('\n## ')[0]
	return [...section.matchAll(/^\| ([A-Z][^|]*?) \| `([^`]+)`/gm)].map(
		([, doctype, link]) => [doctype, link]
	)
}

const valuesFor = (doctype: string) =>
	Object.fromEntries(getRecordRouteFields(doctype).map((f) => [f, `the-${f}`]))

describe('record routes', () => {
	it('sends each record to a page the router knows', () => {
		for (const [doctype] of skillLinks()) {
			const to = getRecordRoute(doctype, 'rec-1', {}, valuesFor(doctype))
			expect(to, doctype).not.toBeNull()
			expect(router.resolve(to!).name, doctype).not.toBe('NotFound')
		}
	})

	it('waits for the fields a page is addressed by', () => {
		expect(getRecordRouteFields('Course Lesson')).toEqual(['course'])
		expect(getRecordRoute('Course Lesson', '0001 Intro')).toBeNull()
		const to = getRecordRoute(
			'Course Lesson',
			'0001 Intro',
			{},
			{ course: 'python' }
		)
		expect(router.resolve(to!).fullPath).toBe(
			'/courses/python?editLessonName=0001+Intro#editor'
		)
	})

	it('opens a program as its edit form only for those who may edit it', () => {
		expect(getRecordRoute('LMS Program', 'p')?.name).toBe('ProgramDetail')
		expect(
			getRecordRoute('LMS Program', 'p', { canEditPrograms: true })?.name
		).toBe('ProgramForm')
	})

	it('has no page for a doctype outside the LMS', () => {
		expect(getRecordRoute('Sales Invoice', 'SINV-1')).toBeNull()
		expect(getDoctypeFromSlug('sales-invoice')).toBeNull()
		expect(getListRoute('Sales Invoice')).toBeNull()
	})

	it('reads a doctype back from its Desk slug', () => {
		expect(doctypeSlug('LMS Programming Exercise')).toBe(
			'lms-programming-exercise'
		)
		expect(getDoctypeFromSlug('lms-programming-exercise')).toBe(
			'LMS Programming Exercise'
		)
		expect(getDoctypeFromSlug('Course-Lesson')).toBe('Course Lesson')
	})

	it('gives lists their list page', () => {
		expect(router.resolve(getListRoute('LMS Quiz')!).fullPath).toBe('/quizzes')
	})
})

describe('the learning-pages skill', () => {
	it('names the page the app opens for each record', () => {
		const links = skillLinks()
		expect(links.length).toBeGreaterThan(10)
		for (const [doctype, link] of links) {
			const path = link
				.replace(/^\/lms/, '')
				.replace(/<name>/, 'rec-1')
				.replace(/<(\w+)>/g, (_match, field) => `the-${field}`)
			const fromSkill = router.resolve(path)
			// the skill leads with the staff page, as Flow's users are staff
			const fromApp = getRecordRoute(
				doctype,
				'rec-1',
				{ canEditPrograms: true },
				valuesFor(doctype)
			)
			expect(fromSkill.name, doctype).not.toBe('NotFound')
			expect(fromSkill.fullPath, doctype).toBe(
				router.resolve(fromApp!).fullPath
			)
		}
	})
})
