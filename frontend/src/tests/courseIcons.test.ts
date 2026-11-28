import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label', 'tooltip', 'iconLeft'],
		emits: ['click'],
		template: '<button @click="$emit(\'click\')">{{ label }}</button>',
	},
	FileUploader: {
		name: 'FileUploader',
		props: ['private', 'fileTypes'],
		template:
			'<div><slot :openFileSelector="() => {}" :uploading="false" /></div>',
	},
	Tooltip: {
		props: ['text'],
		template: '<span :data-tooltip="text"><slot /></span>',
	},
	FileUploadHandler: class {},
	UploadError: class extends Error {},
	toast: { error: vi.fn() },
	FormControl: {
		name: 'FormControl',
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template:
			'<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
	},
}))

import CourseIconPicker from '@/components/InlineEdit/CourseIconPicker.vue'
import CourseThumbnailPicker from '@/components/InlineEdit/CourseThumbnailPicker.vue'
import {
	COURSE_ICONS,
	courseIcon,
	isIconName,
	shuffleThumbnail,
} from '@/utils/courseIcons'
import {
	defineIconClass,
	iconDataUri,
	loadIconNodes,
	loadIconTags,
} from '@/utils/lucideIconStyles'

const options = { global: { mocks: { __: globalThis.__ } } }

describe('course icons', () => {
	it('accepts lucide-shaped names only, as the LMS Course controller does', () => {
		for (const name of ['rocket', 'dice-6', 'chart-no-axes-column'])
			expect(isIconName(name)).toBe(true)
		for (const name of [
			'Rocket',
			'a b',
			'rocket-',
			'-a',
			'a--b',
			'a'.repeat(65),
		])
			expect(isIconName(name)).toBe(false)
	})

	it('falls back to the open book for an empty or unknown icon', () => {
		expect(courseIcon('rocket')).toBe('lucide-rocket')
		expect(courseIcon('')).toBe('lucide-book-open')
		expect(courseIcon(null)).toBe('lucide-book-open')
		expect(courseIcon('<svg>')).toBe('lucide-book-open')
	})

	it('defines the class for any lucide icon at runtime', async () => {
		expect(courseIcon('telescope')).toBe('lucide-telescope')
		await defineIconClass('telescope')
		await defineIconClass('not-a-lucide-icon')
		const rules = [...document.querySelectorAll('style[data-lucide-icons]')]
			.flatMap((style) => [...(style as HTMLStyleElement).sheet!.cssRules])
			.map((rule) => rule.cssText)
		expect(rules).toHaveLength(2)
		expect(rules[0]).toContain('.lucide-telescope')
		expect(rules[1]).toContain('.lucide-not-a-lucide-icon')
	})

	it('draws an icon at the 1.5 stroke of the build-time classes', async () => {
		const nodes = await loadIconNodes()
		const svg = decodeURIComponent(iconDataUri(nodes['book-open']))
		expect(svg).toContain('stroke-width="1.5"')
		expect(svg).toContain('<path d="M12 5v16"/>')
	})

	it('shuffles to a stored colour and a curated icon, never the same pair', () => {
		const random = vi.spyOn(Math, 'random')
		for (const value of [0, 0.5, 0.999]) {
			random.mockReturnValue(value)
			const next = shuffleThumbnail('Red', 'boxes')
			expect(COURSE_ICONS).toContain(next.icon)
			expect(next.color).toMatch(/^[A-Z][a-z]+$/)
			expect(`${next.color}/${next.icon}`).not.toBe('Red/boxes')
		}
		random.mockRestore()
	})
})

describe('the course icon picker', () => {
	const mountIconPicker = async (props: Record<string, unknown> = {}) => {
		const wrapper = mount(CourseIconPicker, { props, ...options })
		await loadIconTags()
		await flushPromises()
		return wrapper
	}
	const labels = (wrapper: ReturnType<typeof mount>) =>
		wrapper.findAll('button').map((button) => button.attributes('aria-label'))

	it('lists the curated icons first, then a page of the rest', async () => {
		const wrapper = await mountIconPicker({ modelValue: 'rocket' })
		expect(labels(wrapper).slice(0, COURSE_ICONS.length)).toEqual(
			COURSE_ICONS.map((name) => name.replace(/-/g, ' '))
		)
		expect(labels(wrapper)).toHaveLength(108)
	})

	it('marks the current icon and emits the one clicked', async () => {
		const wrapper = await mountIconPicker({ modelValue: 'rocket' })
		const rocket = wrapper.get('[aria-label="rocket"]')
		expect(rocket.attributes('aria-pressed')).toBe('true')
		expect(rocket.attributes('tabindex')).toBe('0')
		await wrapper.get('[aria-label="chart line"]').trigger('click')
		expect(wrapper.emitted('update:modelValue')).toEqual([['chart-line']])
	})

	it('shows an icon outside the curated set first', async () => {
		const wrapper = await mountIconPicker({ modelValue: 'telescope' })
		expect(labels(wrapper)[0]).toBe('telescope')
		expect(
			wrapper.get('[aria-label="telescope"]').attributes('aria-pressed')
		).toBe('true')
	})

	it('searches every lucide icon by the start of a name or keyword word', async () => {
		const wrapper = await mountIconPicker()
		await wrapper.get('input').setValue('piggy')
		expect(labels(wrapper)).toContain('piggy bank')
		await wrapper.get('input').setValue('savings')
		expect(labels(wrapper)).toContain('piggy bank')
		await wrapper.get('input').setValue('pen')
		expect(labels(wrapper)).toContain('clipboard pen')
		expect(labels(wrapper)).not.toContain('book open')
		await wrapper.get('input').setValue('zzzz')
		expect(wrapper.findAll('button')).toHaveLength(0)
		expect(wrapper.text()).toContain('No icons match')
	})

	it('moves focus with the arrow keys', async () => {
		const wrapper = await mountIconPicker()
		document.body.append(wrapper.element)
		const grid = wrapper.get('[role="group"]').element as HTMLElement
		grid.style.gridTemplateColumns = Array(12).fill('44px').join(' ')
		const buttons = wrapper.findAll('button')
		;(buttons[0].element as HTMLElement).focus()
		await buttons[0].trigger('keydown', { key: 'ArrowRight' })
		expect(document.activeElement).toBe(buttons[1].element)
		await buttons[1].trigger('keydown', { key: 'ArrowDown' })
		expect(document.activeElement).toBe(buttons[13].element)
		await buttons[13].trigger('keydown', { key: 'Home' })
		expect(document.activeElement).toBe(buttons[0].element)
		wrapper.unmount()
	})

	it('reads an empty icon as the open book', async () => {
		const wrapper = await mountIconPicker()
		expect(
			wrapper.get('[aria-label="book open"]').attributes('aria-pressed')
		).toBe('true')
	})

	// As many cells as fit a row; Down must follow the row as laid out.
	it('steps a row by the columns as laid out', async () => {
		const wrapper = await mountIconPicker()
		document.body.append(wrapper.element)
		const grid = wrapper.get('[role="group"]').element as HTMLElement
		grid.style.gridTemplateColumns = Array(8).fill('35px').join(' ')
		const buttons = wrapper.findAll('button')
		;(buttons[0].element as HTMLElement).focus()
		await buttons[0].trigger('keydown', { key: 'ArrowDown' })
		expect(document.activeElement).toBe(buttons[8].element)
		wrapper.unmount()
	})

	it('lays the icons out as square cells of one size, as many as fit', async () => {
		const large = await mountIconPicker({ large: true })
		expect(large.get('[role="group"]').classes()).toContain(
			'grid-cols-[repeat(auto-fill,2.75rem)]'
		)
		expect(large.get('[aria-label="book open"]').classes()).toContain('size-11')
		const small = await mountIconPicker()
		expect(small.get('[aria-label="book open"]').classes()).toContain('size-9')
	})
})

describe('the course thumbnail picker', () => {
	const mountPicker = (props: Record<string, unknown> = {}) =>
		mount(CourseThumbnailPicker, {
			props: { tint: 'Red', icon: 'boxes', ...props },
			...options,
		})

	it('previews the tint and icon', () => {
		const preview = mountPicker().get('[data-testid="thumbnail-preview"]')
		expect(preview.classes()).toContain('bg-surface-red-2')
		expect(preview.find('.lucide-boxes').exists()).toBe(true)
	})

	it('shuffles both the colour and the icon', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0)
		const wrapper = mountPicker({ tint: 'Blue', icon: 'rocket' })
		const shuffle = wrapper
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Shuffle')
		await shuffle!.trigger('click')
		expect(wrapper.emitted('update:tint')).toEqual([['Red']])
		expect(wrapper.emitted('update:icon')).toEqual([['boxes']])
		vi.restoreAllMocks()
	})

	it('picks a colour and an icon', async () => {
		const wrapper = mountPicker()
		await wrapper.get('[aria-label="teal thumbnail"]').trigger('click')
		await wrapper.get('[aria-label="globe"]').trigger('click')
		expect(wrapper.emitted('update:tint')).toEqual([['Teal']])
		expect(wrapper.emitted('update:icon')).toEqual([['globe']])
	})

	it('marks the picked colour with a dot inside it', () => {
		const wrapper = mountPicker()
		const dot = (color: string) =>
			wrapper.get(`[aria-label="${color} thumbnail"]`).find('span').exists()
		expect(dot('red')).toBe(true)
		expect(dot('teal')).toBe(false)
	})

	it('explains the colour and icon fallback inside the preview, once there is an image', () => {
		expect(mountPicker().find('[data-testid="thumbnail-info"]').exists()).toBe(
			false
		)
		const info = mountPicker({ image: '/files/cover.png' }).get(
			'[data-testid="thumbnail-info"]'
		)
		expect(info.element.parentElement?.dataset.tooltip).toContain(
			'the card shows the colour and icon'
		)
	})

	it('puts the upload first under the preview and Shuffle right after the colours', () => {
		const wrapper = mountPicker()
		const upload = wrapper.get('[data-testid="upload-image"]')
		expect(upload.text()).toBe('Upload image')
		expect(upload.element.previousElementSibling?.textContent).not.toBe(
			'Shuffle'
		)
		const shuffle = wrapper
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Shuffle')
		expect(shuffle!.element.closest('[role="group"]')).not.toBeNull()
		expect(
			mountPicker({ image: '/files/cover.png' })
				.get('[data-testid="upload-image"]')
				.text()
		).toBe('Replace image')
	})

	it('removes an image so the colour and icon show again', async () => {
		const wrapper = mountPicker({ image: '/files/cover.png' })
		const remove = wrapper
			.findAll('button')
			.find((b) => b.text() === 'Remove image')
		await remove!.trigger('click')
		expect(wrapper.emitted('update:image')).toEqual([['']])
		expect(
			mountPicker()
				.findAll('button')
				.some((b) => b.text() === 'Remove image')
		).toBe(false)
	})
})
