/**
 * Links in Flow's chat open the LMS page in this tab: a Desk link to an LMS
 * record is rewritten, an /lms link goes through the router, the rest are left.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const call = vi.fn()
vi.mock('frappe-ui', () => ({ call: (...args: unknown[]) => call(...args) }))

import { routes } from '@/routes'
import { parseFlowLink, routeFlowLinks } from '@/utils/flowLinks'

const ORIGIN = window.location.origin

describe('parseFlowLink', () => {
	it('reads an LMS record off a Desk link', () => {
		expect(parseFlowLink('/desk/lms-course/python')).toEqual({
			kind: 'record',
			doctype: 'LMS Course',
			name: 'python',
		})
		expect(parseFlowLink(`${ORIGIN}/app/course-lesson/0001%20Intro`)).toEqual({
			kind: 'record',
			doctype: 'Course Lesson',
			name: '0001 Intro',
		})
	})

	it('reads a Desk list of an LMS doctype', () => {
		for (const href of ['/desk/lms-batch', '/desk/lms-batch/view/list'])
			expect(parseFlowLink(href)).toEqual({
				kind: 'list',
				doctype: 'LMS Batch',
			})
	})

	it('keeps an LMS page, query and hash included', () => {
		expect(parseFlowLink('/lms/courses/python?tab=1#editor')).toEqual({
			kind: 'page',
			path: '/courses/python?tab=1#editor',
		})
		expect(parseFlowLink('/lms')).toEqual({ kind: 'page', path: '/' })
	})

	it('leaves everything else alone', () => {
		for (const href of [
			'/desk/sales-invoice/SINV-0001',
			'/desk/lms-course/new',
			'/desk',
			'/lmsx/courses',
			'https://example.com/lms/courses',
			'/files/report.pdf',
		])
			expect(parseFlowLink(href), href).toBeNull()
	})
})

describe('routeFlowLinks', () => {
	let router: Router
	let stop: () => void
	let open: ReturnType<typeof vi.spyOn>

	/** A link in the chat, which sits in a shadow root inside Flow's host. */
	const chatLink = (href: string) => {
		const host = document.createElement('flow-launcher')
		const chat = document.createElement('div')
		host.append(chat)
		const anchor = document.createElement('a')
		anchor.href = href
		anchor.target = '_blank'
		chat.attachShadow({ mode: 'open' }).append(anchor)
		document.body.append(host)
		return anchor
	}

	/** Whether the click reached the document with its default taken. */
	const click = (anchor: HTMLAnchorElement, init: MouseEventInit = {}) => {
		let prevented = false
		// after routeFlowLinks' listener; jsdom would try to follow the link
		document.addEventListener(
			'click',
			(event) => {
				prevented = event.defaultPrevented
				event.preventDefault()
			},
			{ once: true }
		)
		anchor.dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
				composed: true,
				cancelable: true,
				...init,
			})
		)
		return prevented
	}

	// never navigated: a page would load its component
	beforeEach(() => {
		router = createRouter({ history: createMemoryHistory(), routes })
		vi.spyOn(router, 'push').mockResolvedValue(undefined)
		open = vi.spyOn(window, 'open').mockReturnValue(null)
		stop = routeFlowLinks(router, () => ({ canEditPrograms: true }))
	})

	afterEach(() => {
		stop()
		call.mockReset()
		vi.restoreAllMocks()
	})

	it('opens an LMS record linked on Desk on its LMS page', async () => {
		const prevented = click(chatLink('/desk/lms-batch/spring-cohort'))
		await vi.waitFor(() =>
			expect(router.push).toHaveBeenCalledWith({
				name: 'BatchDetail',
				params: { batchName: 'spring-cohort' },
			})
		)
		expect(prevented).toBe(true)
		expect(open).not.toHaveBeenCalled()
	})

	it('reads the parent a lesson page is addressed by', async () => {
		call.mockResolvedValue({ course: 'python' })
		click(chatLink('/app/course-lesson/0001%20Intro'))
		await vi.waitFor(() =>
			expect(router.push).toHaveBeenCalledWith({
				name: 'CourseDetail',
				params: { courseName: 'python' },
				query: { editLessonName: '0001 Intro' },
				hash: '#editor',
			})
		)
		expect(call).toHaveBeenCalledWith('frappe.client.get_value', {
			doctype: 'Course Lesson',
			filters: '0001 Intro',
			fieldname: ['course'],
		})
	})

	it('opens the Desk link after all when the record cannot be read', async () => {
		call.mockRejectedValue(new Error('Not permitted'))
		const anchor = chatLink('/desk/course-lesson/secret')
		click(anchor)
		await vi.waitFor(() =>
			expect(open).toHaveBeenCalledWith(anchor.href, '_blank', 'noopener')
		)
		expect(router.push).not.toHaveBeenCalled()
	})

	it('routes an LMS link without reloading the page', async () => {
		click(chatLink('/lms/quizzes/edit/basics'))
		await vi.waitFor(() =>
			expect(router.push).toHaveBeenCalledWith('/quizzes/edit/basics')
		)
	})

	it('keeps the Desk link of a doctype the LMS has no page for', () => {
		expect(click(chatLink('/desk/sales-invoice/SINV-0001'))).toBe(false)
		expect(router.push).not.toHaveBeenCalled()
	})

	it('leaves links outside Flow to the page', () => {
		const anchor = document.createElement('a')
		anchor.href = '/desk/lms-course/python'
		document.body.append(anchor)
		expect(click(anchor)).toBe(false)
		expect(router.push).not.toHaveBeenCalled()
	})

	it('points a link opened in a new tab at the LMS page', () => {
		const anchor = chatLink('/desk/lms-course/python')
		expect(click(anchor, { ctrlKey: true })).toBe(false)
		expect(anchor.getAttribute('href')).toBe('/courses/python')
		expect(router.push).not.toHaveBeenCalled()
	})
})
