import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

const { mobile } = vi.hoisted(() => ({ mobile: { value: false } }))

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		MOBILE_BREAKPOINT: 640,
		useScreenSize: () => ({ isMobile: computed(() => mobile.value) }),
	}
})

vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: {
		name: 'PageHeader',
		props: ['breadcrumbs', 'published', 'loading'],
		template: `<div data-testid="header"><slot name="actions" /></div>`,
	},
}))

vi.mock('frappe-ui', async () => {
	const { computed, defineComponent } = await import('vue')

	const Tabs = defineComponent({
		name: 'Tabs',
		inheritAttrs: false,
		props: {
			tabs: { type: Array, required: true },
			modelValue: { type: Number, default: 0 },
		},
		emits: ['update:modelValue'],
		setup(props) {
			const defaultValue = computed(
				() => (props.tabs[0] as { label: string }).label
			)
			return { defaultValue }
		},
		template: `<div
			data-testid="tabs"
			:data-default-value="defaultValue"
			v-bind="$attrs"
		>
			<div role="tablist">
				<template v-for="(tab, i) in tabs" :key="i">
					<slot name="tab-item" :tab="tab" :selected="i === modelValue" />
				</template>
			</div>
			<div role="tabpanel" data-state="active">
				<slot name="tab-panel" :tab="tabs[modelValue]" />
			</div>
		</div>`,
	})

	return { Tabs }
})

vi.stubGlobal('__', (text: string) => text)

const DOC = { title: 'Intro to Frappe' }

function body(testid: string): Component {
	return defineComponent({
		props: { course: { type: Object, default: null } },
		setup(props) {
			return () =>
				h('div', { 'data-testid': testid }, String(props.course?.title ?? ''))
		},
	})
}

const SettingsBody = defineComponent({
	props: { course: { type: Object, default: null } },
	setup(_props, { expose }) {
		expose({ save: () => 'saved' })
		return () => h('div', { 'data-testid': 'body-settings' })
	},
})

type Tab = {
	key: string
	label: string
	icon: string
	component: Component
	shortLabel?: string
	when?: boolean
	flow?: boolean
	props?: Record<string, unknown>
}

function tabs(overrides: Record<string, Partial<Tab>> = {}): Tab[] {
	const base: Tab[] = [
		{
			key: 'overview',
			label: 'Overview',
			icon: 'lucide-list',
			component: body('body-overview'),
			flow: true,
		},
		{
			key: 'dashboard',
			label: 'Dashboard',
			icon: 'lucide-trending-up',
			component: body('body-dashboard'),
		},
		{
			key: 'editor',
			label: 'Course editor',
			shortLabel: 'Editor',
			icon: 'lucide-book-open',
			component: body('body-editor'),
		},
		{
			key: 'settings',
			label: 'Settings',
			icon: 'lucide-settings-2',
			component: SettingsBody,
			flow: true,
		},
	]
	return base.map((tab) => ({ ...tab, ...(overrides[tab.key] ?? {}) }))
}

async function mountPage(options: {
	tabs: Tab[]
	hash?: string
	slots?: Record<string, unknown>
	props?: Record<string, unknown>
}) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: { render: () => null },
			},
		],
	})
	await router.push(`/courses/abc${options.hash ?? ''}`)
	await router.isReady()

	const { default: TabbedDetailPage } = await import(
		'@/components/Layouts/TabbedDetailPage.vue'
	)
	const wrapper = mount(TabbedDetailPage, {
		props: {
			tabs: options.tabs,
			breadcrumbs: [{ label: 'Courses', route: { name: 'Courses' } }],
			doc: DOC,
			docProp: 'course',
			...options.props,
		},
		slots: options.slots as never,
		global: { plugins: [router] },
	})
	await flushPromises()
	return { wrapper, router }
}

function shell(wrapper: VueWrapper) {
	return wrapper.find('[data-testid="tabs"]')
}

async function openTab(wrapper: any, index: number) {
	wrapper.findComponent({ name: 'Tabs' }).vm.$emit('update:modelValue', index)
	await flushPromises()
}

const solo = () => h('div', { 'data-testid': 'solo' }, 'Solo')

describe('TabbedDetailPage tab visibility', () => {
	it('drops a tab whose `when` is false and keeps the ones that say nothing', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs({ settings: { when: false } }),
		})

		const shown = wrapper.findComponent({ name: 'Tabs' }).props('tabs') as Tab[]
		expect(shown.map((tab) => tab.key)).toEqual([
			'overview',
			'dashboard',
			'editor',
		])
	})

	it('keeps a tab whose `when` is true', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs({ settings: { when: true } }),
		})

		const shown = wrapper.findComponent({ name: 'Tabs' }).props('tabs') as Tab[]
		expect(shown.map((tab) => tab.key)).toContain('settings')
	})

	it('renders the single view instead of a tab shell when no tab is visible', async () => {
		const hidden = tabs({
			overview: { when: false },
			dashboard: { when: false },
			editor: { when: false },
			settings: { when: false },
		})

		const { wrapper } = await mountPage({ tabs: hidden, slots: { solo } })

		expect(shell(wrapper).exists()).toBe(false)
		expect(wrapper.find('[data-testid="solo"]').exists()).toBe(true)
	})

	it('renders nothing rather than throwing when there is no single view either', async () => {
		const hidden = tabs({
			overview: { when: false },
			dashboard: { when: false },
			editor: { when: false },
			settings: { when: false },
		})

		const { wrapper } = await mountPage({ tabs: hidden })

		expect(shell(wrapper).exists()).toBe(false)
		expect(wrapper.find('[data-testid="header"]').exists()).toBe(true)
	})

	it('is a TypeError the moment an empty list does reach the tabs', async () => {
		const { Tabs } = (await import('frappe-ui')) as unknown as {
			Tabs: Component
		}

		expect(() => mount(Tabs, { props: { tabs: [] } })).toThrow(TypeError)
	})
})

describe('TabbedDetailPage hash', () => {
	it('opens the tab the hash names', async () => {
		const { wrapper } = await mountPage({ tabs: tabs(), hash: '#settings' })

		expect(wrapper.find('[data-testid="body-settings"]').exists()).toBe(true)
	})

	it('writes the tab key into the hash, not its translated label', async () => {
		const { wrapper, router } = await mountPage({ tabs: tabs() })

		await openTab(wrapper, 2)

		expect(router.currentRoute.value.hash).toBe('#editor')
		expect(wrapper.find('[data-testid="body-editor"]').exists()).toBe(true)
	})

	it('switches tabs when the hash changes under it', async () => {
		const { wrapper, router } = await mountPage({ tabs: tabs() })
		expect(wrapper.find('[data-testid="body-overview"]').exists()).toBe(true)

		await router.push('/courses/abc#dashboard')
		await flushPromises()

		expect(wrapper.find('[data-testid="body-dashboard"]').exists()).toBe(true)
	})

	it('ignores a hash that names no tab', async () => {
		const { wrapper } = await mountPage({ tabs: tabs(), hash: '#nonsense' })

		expect(wrapper.find('[data-testid="body-overview"]').exists()).toBe(true)
	})

	it('lands a deep link on a tab that only appears once the document has', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs({ settings: { when: false } }),
			hash: '#settings',
		})
		expect(wrapper.find('[data-testid="body-settings"]').exists()).toBe(false)

		await wrapper.setProps({ tabs: tabs({ settings: { when: true } }) })
		await flushPromises()

		expect(wrapper.find('[data-testid="body-settings"]').exists()).toBe(true)
	})

	it('brings the open tab back in range when the visible set shrinks', async () => {
		const { wrapper } = await mountPage({ tabs: tabs() })
		await openTab(wrapper, 3)
		expect(wrapper.find('[data-testid="body-settings"]').exists()).toBe(true)

		await wrapper.setProps({
			tabs: tabs({ editor: { when: false }, settings: { when: false } }),
		})
		await flushPromises()

		expect(wrapper.find('[data-testid="body-overview"]').exists()).toBe(true)
	})
})

describe('TabbedDetailPage document binding', () => {
	it('hands the document to the tab under the page name for it', async () => {
		const { wrapper } = await mountPage({ tabs: tabs() })

		expect(wrapper.find('[data-testid="body-overview"]').text()).toBe(DOC.title)
	})

	it('mounts no tab body before the document arrives', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs(),
			props: { loading: true },
		})

		expect(shell(wrapper).exists()).toBe(true)
		expect(wrapper.find('[data-testid="body-overview"]').exists()).toBe(false)
	})

	it('lets a page render one tab itself, and leaves the rest alone', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs(),
			hash: '#editor',
			slots: {
				'tab-body-editor': () => h('div', { 'data-testid': 'own-editor' }),
			},
		})

		expect(wrapper.find('[data-testid="own-editor"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="body-editor"]').exists()).toBe(false)

		await openTab(wrapper, 0)
		expect(wrapper.find('[data-testid="body-overview"]').exists()).toBe(true)
	})
})

describe('TabbedDetailPage mobile flow', () => {
	it('releases the scroll box for a tab that flows with the page', async () => {
		mobile.value = true
		const { wrapper } = await mountPage({ tabs: tabs() })

		expect(shell(wrapper).classes()).toContain('page-flow')
		expect(wrapper.classes()).toContain('min-h-full')
	})

	it('keeps the scroll box for a tab that owns one', async () => {
		mobile.value = true
		const { wrapper } = await mountPage({ tabs: tabs() })

		await openTab(wrapper, 1)

		expect(shell(wrapper).classes()).not.toContain('page-flow')
		expect(wrapper.classes()).toContain('h-full')
	})

	it('never flows on a desk, whatever the tab asked for', async () => {
		mobile.value = false
		const { wrapper } = await mountPage({ tabs: tabs() })

		expect(shell(wrapper).classes()).not.toContain('page-flow')
	})
})

describe('TabbedDetailPage actions', () => {
	it('hands the actions slot the tab that is open', async () => {
		const seen: { key?: string } = {}
		const { wrapper } = await mountPage({
			tabs: tabs(),
			slots: {
				actions: (props: { tab?: Tab }) => {
					seen.key = props.tab?.key
					return h('button', { 'data-testid': 'action' }, 'Do')
				},
			},
		})

		expect(seen.key).toBe('overview')
		expect(wrapper.find('[data-testid="action"]').exists()).toBe(true)

		await openTab(wrapper, 2)

		expect(seen.key).toBe('editor')
	})

	it('hands the actions slot the open tab’s own instance', async () => {
		const seen: { instance?: { save?: () => string } } = {}
		const { wrapper } = await mountPage({
			tabs: tabs(),
			slots: {
				actions: (props: { instance?: { save?: () => string } }) => {
					seen.instance = props.instance
					return h('span')
				},
			},
		})

		expect(seen.instance?.save).toBeUndefined()

		await openTab(wrapper, 3)
		await nextTick()

		expect(seen.instance?.save?.()).toBe('saved')
	})
})

describe('TabbedDetailPage tab strip', () => {
	it('drops the icon and takes the short label below the breakpoint', async () => {
		mobile.value = true
		const { wrapper } = await mountPage({ tabs: tabs() })

		const strip = wrapper.find('[role="tablist"]')
		expect(strip.text()).toContain('Editor')
		expect(strip.text()).not.toContain('Course editor')
		expect(strip.find('.lucide-list').exists()).toBe(false)
	})

	it('keeps both on a desk', async () => {
		mobile.value = false
		const { wrapper } = await mountPage({ tabs: tabs() })

		const strip = wrapper.find('[role="tablist"]')
		expect(strip.text()).toContain('Course editor')
		expect(strip.find('.lucide-list').exists()).toBe(true)
	})
})
