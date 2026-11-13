import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, markRaw } from 'vue'
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

vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: {
		name: 'PageHeader',
		props: ['breadcrumbs', 'published', 'loading'],
		template: `<div data-testid="header"><slot name="actions" /></div>`,
	},
}))

vi.mock('frappe-ui', async () => {
	const { computed, defineComponent, watch } = await import('vue')

	// A stand-in for the composed Tabs family's shorthand mode: a `value` keyed
	// model, the `#tab-prefix`/`#tab-label`/`#tab-panel` slots, and the real
	// component's stale-model fallback (an unknown value snaps to the first tab
	// and emits) so the page's own hash-sync is exercised the way it runs in
	// production.
	const Tabs = defineComponent({
		name: 'Tabs',
		inheritAttrs: false,
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
		template: `<div
			data-testid="tabs"
			v-bind="$attrs"
		>
			<div role="tablist">
				<template v-for="(tab, i) in tabs" :key="i">
					<slot name="tab-prefix" :tab="tab" :selected="tab.value === selected" />
					<slot name="tab-label" :tab="tab" :selected="tab.value === selected" />
				</template>
			</div>
			<div role="tabpanel" data-state="active">
				<slot name="tab-panel" :tab="tabs.find((t) => t.value === selected)" />
			</div>
		</div>`,
	})

	return { Tabs }
})

vi.stubGlobal('__', (text: string) => text)

const DOC = { title: 'Intro to Frappe' }

function body(testid: string): Component {
	return markRaw(
		defineComponent({
			props: { course: { type: Object, default: null } },
			setup(props) {
				return () =>
					h('div', { 'data-testid': testid }, String(props.course?.title ?? ''))
			},
		})
	)
}

const SettingsBody = markRaw(
	defineComponent({
		props: { course: { type: Object, default: null } },
		setup() {
			return () => h('div', { 'data-testid': 'body-settings' })
		},
	})
)

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
		'@/components/Layouts/pages/TabbedDetailPage.vue'
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

async function openTab(wrapper: any, key: string) {
	wrapper.findComponent({ name: 'Tabs' }).vm.$emit('update:modelValue', key)
	await flushPromises()
}

const solo = () => h('div', { 'data-testid': 'solo' }, 'Solo')

describe('TabbedDetailPage tab visibility', () => {
	it('drops a tab whose `when` is false and keeps the ones that say nothing', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs({ settings: { when: false } }),
		})

		const shown = wrapper.findComponent({ name: 'Tabs' }).props('tabs') as {
			data: Tab
		}[]
		expect(shown.map((tab) => tab.data.key)).toEqual([
			'overview',
			'dashboard',
			'editor',
		])
	})

	it('keeps a tab whose `when` is true', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs({ settings: { when: true } }),
		})

		const shown = wrapper.findComponent({ name: 'Tabs' }).props('tabs') as {
			data: Tab
		}[]
		expect(shown.map((tab) => tab.data.key)).toContain('settings')
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
})

describe('TabbedDetailPage hash', () => {
	it('opens the tab the hash names', async () => {
		const { wrapper } = await mountPage({ tabs: tabs(), hash: '#settings' })

		expect(wrapper.find('[data-testid="body-settings"]').exists()).toBe(true)
	})

	it('writes the tab key into the hash, not its translated label', async () => {
		const { wrapper, router } = await mountPage({ tabs: tabs() })

		await openTab(wrapper, 'editor')

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
		await openTab(wrapper, 'settings')
		expect(wrapper.find('[data-testid="body-settings"]').exists()).toBe(true)

		await wrapper.setProps({
			tabs: tabs({ editor: { when: false }, settings: { when: false } }),
		})
		await flushPromises()

		expect(wrapper.find('[data-testid="body-overview"]').exists()).toBe(true)
	})
})

describe('TabbedDetailPage document binding', () => {
	it('mounts no tab body before the document arrives', async () => {
		const { wrapper } = await mountPage({
			tabs: tabs(),
			props: { loading: true },
		})

		expect(shell(wrapper).exists()).toBe(true)
		expect(wrapper.find('[data-testid="body-overview"]').exists()).toBe(false)
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

		await openTab(wrapper, 'editor')

		expect(seen.key).toBe('editor')
	})
})
