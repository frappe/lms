import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		MOBILE_BREAKPOINT: 640,
		useScreenSize: () => ({ isMobile: computed(() => false) }),
	}
})

// Renders each crumb as a link so an empty label shows up as an unnamed link,
// which is what the real Breadcrumbs does.
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: {
		name: 'PageHeader',
		props: ['breadcrumbs', 'published', 'loading'],
		template: `<header><a v-for="(crumb, i) in breadcrumbs" :key="i" href="#">{{ crumb.label }}</a><slot name="actions" /></header>`,
	},
}))

vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: { props: ['title'], template: `<div><slot /></div>` },
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
	const { computed, defineComponent, reactive, watch, watchEffect } =
		await import('vue')

	const Tabs = defineComponent({
		name: 'Tabs',
		props: {
			tabs: { type: Array, required: true },
			modelValue: { type: [String, Number], default: undefined },
		},
		emits: ['update:modelValue'],
		setup(props, { emit }) {
			const selected = computed(() => {
				const items = props.tabs as { value: unknown }[]
				const known = items.some((tab) => tab.value === props.modelValue)
				return known ? props.modelValue : items[0]?.value
			})
			watch(
				selected,
				(value) => {
					if (value !== props.modelValue) emit('update:modelValue', value)
				},
				{ immediate: true }
			)
			return { selected }
		},
		template: `<div>
			<div role="tablist">
				<template v-for="(tab, i) in tabs" :key="i">
					<slot name="tab-label" :tab="tab" />
				</template>
			</div>
			<div role="tabpanel">
				<slot name="tab-panel" :tab="tabs.find((t) => t.value === selected)" />
			</div>
		</div>`,
	})

	// Same contract as frappe-ui's: an empty title leaves document.title alone.
	const usePageMeta = (fn: () => { title?: string } | null) =>
		watchEffect(() => {
			const meta = fn()
			if (meta?.title) document.title = meta.title
		})

	// Every title fetch fails: the pages must still name their crumbs.
	const createResource = () => reactive({ data: null, error: 'failed' })

	return {
		Tabs,
		usePageMeta,
		createResource,
		Button: { template: '<button type="button"><slot /></button>' },
		Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
		Popover: { props: ['open'], template: '<div><slot /></div>' },
	}
})

import TabbedDetailPage from '@/components/Layouts/pages/TabbedDetailPage.vue'
import type { DetailTab } from '@/components/Layouts/pages/TabbedDetailPage.vue'
import NotFound from '@/pages/NotFound.vue'
import QuizPage from '@/pages/QuizPage.vue'
import AssignmentSubmission from '@/pages/AssignmentSubmission.vue'
import InstallPrompt from '@/components/InstallPrompt.vue'

const Blank = defineComponent({ render: () => h('div') })

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'Home', component: Blank },
			{ path: '/detail', name: 'Detail', component: Blank },
			{ path: '/quizzes', name: 'Quizzes', component: Blank },
			{ path: '/quiz/:quizID', name: 'QuizForm', component: Blank },
			{ path: '/assignments', name: 'Assignments', component: Blank },
			{
				path: '/submissions',
				name: 'AssignmentSubmissions',
				component: Blank,
			},
			{
				path: '/assignment/:assignmentID',
				name: 'AssignmentSubmission',
				component: Blank,
			},
		],
	})

const mountWith = async (
	component: Component,
	props: Record<string, unknown> = {},
	slots: Record<string, () => unknown> = {}
): Promise<VueWrapper> => {
	const router = makeRouter()
	await router.push('/detail')
	const wrapper = mount(component, {
		props,
		slots,
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'a@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const tab = (key: string, over: Partial<DetailTab> = {}): DetailTab => ({
	key,
	label: key,
	icon: 'lucide-list',
	component: defineComponent({
		render: () => h('section', { 'data-testid': key }),
	}),
	...over,
})

const CRUMBS = [
	{ label: 'Courses', route: { name: 'Home' } },
	{ label: 'Intro to Frappe', route: { name: 'Detail' } },
]

const detailPage = (tabs: DetailTab[], loading = false) =>
	mountWith(
		TabbedDetailPage,
		{ tabs, breadcrumbs: CRUMBS, doc: {}, docProp: 'course', loading },
		{ solo: () => h('h1', 'Solo overview') }
	)

describe('TabbedDetailPage heading', () => {
	// Guards: detail pages with no h1. Introduced in #2637; test added with the
	// a11y audit remediation.
	it('names the page with one sr-only h1 carrying the doc title', async () => {
		const wrapper = await detailPage([tab('dashboard'), tab('settings')])
		const headings = wrapper.findAll('h1')
		expect(headings).toHaveLength(1)
		expect(headings[0].text()).toBe('Intro to Frappe')
		expect(headings[0].classes()).toContain('sr-only')
	})

	it('leaves the heading to a tab body that renders its own h1', async () => {
		const Overview = defineComponent({
			render: () => h('h1', 'Intro to Frappe'),
		})
		const wrapper = await detailPage([
			tab('overview', { component: Overview, rendersHeading: true }),
			tab('settings'),
		])
		expect(wrapper.findAll('h1')).toHaveLength(1)
		expect(wrapper.find('h1').classes()).not.toContain('sr-only')
	})

	it('adds no second h1 over the solo overview', async () => {
		const wrapper = await detailPage([tab('dashboard', { when: false })])
		expect(wrapper.findAll('h1').map((h1) => h1.text())).toEqual([
			'Solo overview',
		])
	})

	it('holds the heading back until the doc title has loaded', async () => {
		const wrapper = await detailPage([tab('dashboard')], true)
		expect(wrapper.find('h1').exists()).toBe(false)
	})
})

describe('document.title', () => {
	// Guards: missing or "undefined" window titles. Introduced in #1413 and
	// #2577; test added with the a11y audit remediation.
	beforeEach(() => {
		document.title = 'Stale title'
	})

	it('NotFound titles the window', async () => {
		await mountWith(NotFound)
		expect(document.title).toBe('Page not found')
	})

	it('QuizPage never titles the window "undefined"', async () => {
		await mountWith(QuizPage, { quizID: 'QUIZ-1' })
		expect(document.title).toBe('Quiz')
	})
})

describe('breadcrumb fallback when the title fetch fails', () => {
	// Guards: unnamed breadcrumb links. Introduced in #1413 and #2823; test added
	// with the a11y audit remediation.
	const crumbTexts = (wrapper: VueWrapper) =>
		wrapper.findAll('header a').map((link) => link.text())

	it('QuizPage names its middle crumb', async () => {
		const wrapper = await mountWith(QuizPage, { quizID: 'QUIZ-1' })
		expect(crumbTexts(wrapper)).toEqual(['Quizzes', 'Quiz', 'Test Quiz'])
	})

	it('AssignmentSubmission names its last crumb', async () => {
		const wrapper = await mountWith(AssignmentSubmission, {
			assignmentID: 'ASG-1',
		})
		expect(crumbTexts(wrapper)).toEqual([
			'Assignments',
			'Submissions',
			'Assignment',
		])
	})
})

describe('InstallPrompt close target', () => {
	// Guards: a 16px close target. Introduced in #2598; test added with the a11y
	// audit remediation.
	it('is a 24px button around a decorative glyph', async () => {
		const wrapper = await mountWith(InstallPrompt)
		const close = wrapper.get('button[aria-label="Close"]')
		expect(close.classes()).toContain('size-6')
		const glyph = close.get('.lucide-x')
		expect(glyph.element.tagName).toBe('SPAN')
		expect(glyph.attributes('aria-hidden')).toBe('true')
		expect(glyph.classes()).toContain('size-4')
	})
})
