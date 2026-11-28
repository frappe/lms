import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

const { batchResource } = vi.hoisted(() => ({
	batchResource: {
		data: {
			name: 'B1',
			title: 'Batch One',
			can_manage: true,
			is_student: false,
		} as Record<string, unknown>,
		loading: false,
		fetched: true,
		reload: () => {},
		submit: () => Promise.resolve(),
	},
}))

vi.mock('frappe-ui', () => ({
	createResource: () => batchResource,
	createDocumentResource: () => ({
		doc: null,
		reload: vi.fn(),
		setValue: { submit: vi.fn() },
	}),
	call: vi.fn(() => Promise.resolve([])),
	usePageMeta: () => {},
	toast: { success: vi.fn(), error: vi.fn() },
	Badge: { template: `<span><slot /></span>` },
	Tooltip: { template: `<div><slot /></div>` },
	Button: { template: `<button><slot /></button>` },
	Dropdown: { template: `<div />` },
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

const { inert } = vi.hoisted(() => ({
	inert: () => ({ default: { render: () => null } }),
}))
vi.mock('@/pages/Batches/components/AdminBatchDashboard.vue', inert)
vi.mock('@/pages/Batches/components/BatchDashboard.vue', inert)
vi.mock('@/pages/Batches/BatchOverview.vue', inert)
vi.mock('@/pages/Batches/components/LiveClass.vue', inert)
vi.mock('@/pages/Batches/components/Announcements.vue', inert)
vi.mock('@/pages/Batches/BatchForm.vue', inert)
vi.mock('@/components/Discussions.vue', inert)
vi.mock('@/components/SkeletonLoader.vue', inert)
vi.mock('@/components/ShortcutTooltip.vue', () => ({
	default: { template: `<div><slot /></div>` },
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		props: ['label'],
		emits: ['click'],
		template: `<button :data-label="label" @click="$emit('click')">{{ label }}</button>`,
	},
}))
vi.mock('@/components/StudentViewBar.vue', () => ({
	default: {
		props: ['modelValue', 'doctype', 'name'],
		emits: ['update:modelValue', 'exit'],
		template: `<div class="student-bar" :data-mode="modelValue" :data-doctype="doctype" :data-name="name">
			<button class="as-enrolled" @click="$emit('update:modelValue', 'enrolled')" />
			<button class="exit" @click="$emit('exit')" />
		</div>`,
	},
}))

const captured = vi.hoisted(() => ({ tabs: [] as any[], doc: null as any }))

vi.mock('@/components/Layouts/pages/TabbedDetailPage.vue', async () => {
	const { defineComponent, h, watchEffect } = await import('vue')
	return {
		default: defineComponent({
			props: ['tabs', 'breadcrumbs', 'published', 'loading', 'doc', 'docProp'],
			setup(props: { tabs: any[]; doc: any }, { slots }) {
				watchEffect(() => {
					captured.tabs = props.tabs
					captured.doc = props.doc
				})
				return () =>
					h('div', slots.actions?.({ tab: { key: 'overview' } }) ?? [])
			},
		}),
	}
})

// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchDetail from '@/pages/Batches/BatchDetail.vue'

const visibleTabs = () =>
	captured.tabs
		.filter((tab: { when?: boolean }) => tab.when)
		.map((tab: { key: string }) => tab.key)

const mountPage = async () => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: BatchDetail,
				props: true,
			},
		],
	})
	router.push('/batches/B1')
	await router.isReady()
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'mod@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

describe("BatchDetail's student view", () => {
	beforeEach(() => {
		captured.tabs = []
	})

	it('opens from the overview as a learner who has not enrolled', async () => {
		const wrapper = await mountPage()
		expect(visibleTabs()).toContain('settings')

		await wrapper.find('[data-label="Student view"]').trigger('click')
		expect(wrapper.find('.student-bar').attributes('data-mode')).toBe(
			'not-enrolled'
		)
		expect(wrapper.find('.student-bar').attributes('data-doctype')).toBe(
			'LMS Batch'
		)
		expect(wrapper.find('.student-bar').attributes('data-name')).toBe('B1')
		expect(visibleTabs()).toEqual([])
		expect(captured.doc.data.can_manage).toBe(false)
	})

	it('shows the learner tabs once previewed as enrolled', async () => {
		const wrapper = await mountPage()
		await wrapper.find('[data-label="Student view"]').trigger('click')
		await wrapper.find('.as-enrolled').trigger('click')

		expect(visibleTabs()).toEqual([
			'overview',
			'dashboard',
			'classes',
			'announcements',
		])
		expect(captured.doc.data.is_student).toBe(true)
	})

	it('returns to the instructor page on exit', async () => {
		const wrapper = await mountPage()
		await wrapper.find('[data-label="Student view"]').trigger('click')
		await wrapper.find('.exit').trigger('click')

		expect(wrapper.find('.student-bar').exists()).toBe(false)
		expect(visibleTabs()).toContain('settings')
		expect(captured.doc.data.can_manage).toBe(true)
	})
})
