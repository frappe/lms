import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

// Renders each crumb as a link so an empty label shows up as an unnamed link,
// which is what the real Breadcrumbs does.
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: {
		props: ['breadcrumbs'],
		template: `<header><a v-for="(crumb, i) in breadcrumbs" :key="i" href="#">{{ crumb.label }}</a></header>`,
	},
}))
vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: { template: `<div><slot /></div>` },
}))
vi.mock('@/components/Quiz.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/Assignment.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/composables/useStudentView', () => ({
	provideStudentView: vi.fn(),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

vi.mock('frappe-ui', async () => {
	const { reactive, watchEffect } = await import('vue')
	return {
		// Same contract as frappe-ui's: an empty title leaves document.title alone.
		usePageMeta: (fn: () => { title?: string } | null) =>
			watchEffect(() => {
				const meta = fn()
				if (meta?.title) document.title = meta.title
			}),
		// Every title fetch fails: the pages must still name their crumbs.
		createResource: () => reactive({ data: null, error: 'failed' }),
		Button: { template: '<button type="button"><slot /></button>' },
		Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
		Popover: { template: '<div><slot /></div>' },
	}
})

import NotFound from '@/pages/NotFound.vue'
import QuizPage from '@/pages/QuizPage.vue'
import AssignmentSubmission from '@/pages/AssignmentSubmission.vue'
import InstallPrompt from '@/components/InstallPrompt.vue'

const mountWith = async (
	component: Component,
	props: Record<string, unknown> = {}
) => {
	const routes = ['Home', 'Quizzes', 'Assignments', 'AssignmentSubmissions']
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			...routes.map((name) => ({ path: `/${name}`, name, component: {} })),
			{ path: '/quiz/:quizID', name: 'QuizForm', component: {} },
			{ path: '/a/:assignmentID', name: 'AssignmentSubmission', component: {} },
		],
	})
	document.title = 'Stale title'
	const wrapper = mount(component, {
		props,
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'a@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

describe('detail pages with an overview tab', () => {
	// Guards: a second h1 over the overview tab. Introduced in #2637; test added
	// with the a11y audit remediation.
	const read = (file: string) =>
		readFileSync(join(__dirname, '..', file), 'utf8')

	it.each([
		['pages/Courses/CourseDetail.vue', 'pages/Courses/CourseOverview.vue'],
		['pages/Batches/BatchDetail.vue', 'pages/Batches/BatchOverview.vue'],
	])('%s lets %s supply the h1', (detail, overview) => {
		const tab = read(detail).match(/\{\s*key: 'overview',[^}]*\}/)?.[0]
		expect(tab).toMatch(/rendersHeading: true/)
		expect(read(overview)).toMatch(/<h1[\s>]/)
	})
})

describe('window titles and breadcrumbs', () => {
	// Guards: missing or "undefined" window titles and unnamed breadcrumb links
	// when the title fetch fails. Introduced in #1413, #2577 and #2823; test
	// added with the a11y audit remediation.
	it.each([
		[NotFound, {}, 'Page not found', []],
		[QuizPage, { quizID: 'Q-1' }, 'Quiz', ['Quizzes', 'Quiz', 'Test Quiz']],
		[
			AssignmentSubmission,
			{ assignmentID: 'A-1' },
			'Assignment',
			['Assignments', 'Submissions', 'Assignment'],
		],
	])(
		'%#: titles the window and names every crumb',
		async (page, props, title, crumbs) => {
			const wrapper = await mountWith(page, props)
			expect(document.title).toBe(title)
			expect(wrapper.findAll('header a').map((a) => a.text())).toEqual(crumbs)
		}
	)
})

describe('InstallPrompt close target', () => {
	// Guards: 16px remove/close targets. Introduced in #2598 and #2662; test
	// added with the a11y audit remediation.
	it('is a 24px button around a decorative glyph', async () => {
		const wrapper = await mountWith(InstallPrompt)
		const close = wrapper.get('button[aria-label="Close"]')
		expect(close.classes()).toContain('size-6')
		expect(close.get('.lucide-x').attributes('aria-hidden')).toBe('true')
	})
})
