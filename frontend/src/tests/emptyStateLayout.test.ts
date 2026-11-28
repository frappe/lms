import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.stubGlobal('__', (text: string) => text)
// translation.js installs String.prototype.format at app boot; the component
// calls __('No {0} Found').format(name) and never reaches Vue without it.
if (!('format' in String.prototype)) {
	// eslint-disable-next-line no-extend-native
	Object.defineProperty(String.prototype, 'format', {
		value: function (...args: string[]) {
			return this.replace(/\{(\d+)\}/g, (_: string, i: number) => args[i] ?? '')
		},
	})
}

import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

// The class strings ARE the behaviour, since this component renders nothing
// but layout. Each assertion below fails if its class is removed.
const mountEmpty = (
	props: Record<string, unknown> = {},
	options: Record<string, unknown> = {}
) =>
	mount(EmptyStateLayout, {
		props: { name: 'Courses', ...props },
		global: { mocks: {}, stubs: {} },
		...options,
	})

describe('EmptyStateLayout', () => {
	// The component owns its height: callers used to lift it with their own
	// wrappers (`pb-24`, `min-h-[60vh]`, `mt-60`), so pages disagreed on where
	// an empty state sat. Spacers split the leftover space 2:3 instead.
	it('fills its container and sits a little above the middle', () => {
		const wrapper = mountEmpty()
		const outer = wrapper.element as HTMLElement
		const [above, content, below] = Array.from(outer.children)

		expect(outer.className).toContain('flex-1')
		expect(outer.className).toContain('h-full')
		expect(outer.className).not.toContain('top-1/3')
		expect(content.hasAttribute('data-empty-state-content')).toBe(true)
		expect(above.className).toBe('grow-[2]')
		expect(below.className).toBe('grow-[3]')
	})

	// Headers and toolbars above the box differ per page, so a ratio of the box
	// alone put a list's empty state lower than NotFound's. The copy's centre
	// goes on one line of the viewport instead.
	const placeIn = async (box: { top: number; height: number }) => {
		const wrapper = mountEmpty({}, { attachTo: document.body })
		const outer = wrapper.element as HTMLElement
		const content = wrapper.get('[data-empty-state-content]')
			.element as HTMLElement
		outer.getBoundingClientRect = () => ({ ...box } as DOMRect)
		Object.defineProperty(content, 'offsetHeight', { value: 100 })
		window.innerHeight = 900
		window.dispatchEvent(new Event('resize'))
		await nextTick()
		return { wrapper, content }
	}

	it('centres the copy at 45% of the viewport, whatever sits above', async () => {
		const below100 = await placeIn({ top: 100, height: 800 })
		const below200 = await placeIn({ top: 200, height: 700 })

		// 900 * 0.45 = 405 for the centre; minus the box top and half the copy.
		expect(below100.content.style.marginTop).toBe('255px')
		expect(below200.content.style.marginTop).toBe('155px')
		expect(below100.wrapper.find('.grow-\\[2\\]').exists()).toBe(false)
	})

	it('keeps the copy inside a box too short to reach the line', async () => {
		const low = await placeIn({ top: 600, height: 300 })
		const short = await placeIn({ top: 0, height: 200 })

		expect(low.content.style.marginTop).toBe('0px')
		expect(short.content.style.marginTop).toBe('100px')
	})

	it('drops the spacers and the fill when compact', () => {
		const wrapper = mountEmpty({ compact: true })
		const outer = wrapper.element as HTMLElement

		expect(outer.children).toHaveLength(1)
		expect(outer.className).toContain('py-10')
		expect(outer.className).not.toContain('flex-1')
		expect(outer.className).not.toContain('min-h-64')
		expect(outer.dataset.compact).toBe('true')
	})

	it('renders the title as a heading when asked', () => {
		expect(mountEmpty({ titleTag: 'h1' }).get('h1').text()).toBe(
			'No Courses Found'
		)
		expect(mountEmpty().find('h1').exists()).toBe(false)
	})

	it('fills the phone width, and only narrows from sm up', () => {
		const panel = mountEmpty().get('[data-empty-state-content]')

		expect(panel.classes()).toContain('w-full')
		expect(panel.classes()).toContain('sm:w-4/12')
		// The unqualified fractional width was the bug: ~130px on a 390px screen.
		expect(panel.classes()).not.toContain('w-4/12')
	})

	it('keeps the desktop widths behind sm for every size', () => {
		expect(
			mountEmpty({ width: 'sm' }).get('[data-empty-state-content]').classes()
		).toContain('sm:w-2/12')
		expect(
			mountEmpty({ width: 'lg' }).get('[data-empty-state-content]').classes()
		).toContain('sm:w-8/12')
	})

	it('draws a larger icon on a phone than on the desk', () => {
		const icon = mountEmpty().get('span.lucide-graduation-cap')

		expect(icon.classes()).toContain('size-10')
		expect(icon.classes()).toContain('sm:size-7.5')
	})

	it('steps the type down on a phone rather than up', () => {
		const wrapper = mountEmpty()
		const title = wrapper.get('.text-base-medium')
		const description = wrapper.get('.text-p-sm')

		expect(title.classes()).toContain('sm:text-lg-medium')
		expect(description.classes()).toContain('sm:text-p-base')
	})

	it('centres via flex, not a physical offset, so RTL is unaffected', () => {
		const outer = mountEmpty().element

		expect(outer.className).toContain('items-center')
		expect(outer.className).not.toContain('left-1/2')
	})

	it('still renders the copy it is given', () => {
		const wrapper = mountEmpty({
			title: 'Nothing here',
			description: 'Try again later',
		})

		expect(wrapper.text()).toContain('Nothing here')
		expect(wrapper.text()).toContain('Try again later')
	})
})

describe('callers leave the position to EmptyStateLayout', () => {
	const sources = import.meta.glob('../**/*.vue', {
		query: '?raw',
		import: 'default',
		eager: true,
	}) as Record<string, string>
	const POSITIONAL = /\b(min-h-|h-full|flex-1|grow|p[tby]-|m[tby]-|top-)/

	it('passes no positional class to an empty state', () => {
		const tags = Object.entries(sources).flatMap(([path, code]) =>
			(code.match(/<(EmptyStateLayout|LoadError)\b[^>]*>/g) ?? []).map(
				(tag) => ({ path, classes: tag.match(/\sclass="([^"]*)"/)?.[1] ?? '' })
			)
		)
		const offenders = tags
			.filter(({ classes }) => POSITIONAL.test(classes))
			.map(({ path, classes }) => `${path}: ${classes}`)

		expect(tags.length).toBeGreaterThan(30)
		expect(offenders).toEqual([])
	})

	it('has no hand-rolled lift left in the pages that had one', () => {
		const lifts: Record<string, RegExp> = {
			'../components/Layouts/pages/ListPage.vue': /pb-24/,
			'../pages/Home/AdminHome.vue': /mt-60/,
			'../components/CourseEditorEmptyState.vue': /pb-16/,
		}
		for (const [path, lift] of Object.entries(lifts)) {
			expect(sources[path], path).toBeTruthy()
			expect(sources[path], path).not.toMatch(lift)
		}
	})
})
