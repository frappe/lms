import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label'],
		template:
			'<button :aria-label="label"><slot name="icon" /><slot /></button>',
	},
	FileUploader: {
		template:
			'<div><slot :openFileSelector="() => {}" :uploading="false" /></div>',
	},
	FormControl: {
		name: 'FormControl',
		props: ['variant'],
		template: '<input />',
	},
	Dropdown: {
		name: 'Dropdown',
		props: ['options'],
		template: `<div><slot /><button
			v-for="option in options"
			:key="option.label"
			:data-testid="'option-' + option.label"
			@click="option.onClick()"
		>{{ option.label }}</button></div>`,
	},
	Popover: { template: '<div><slot name="trigger" /></div>' },
	Select: {
		name: 'Select',
		props: ['modelValue', 'options', 'variant'],
		template: '<div />',
	},
	UploadError: class extends Error {},
	toast: { error: vi.fn() },
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: {
		name: 'RichTextEditor',
		props: {
			menuOnFocus: Boolean,
			variant: String,
			toolbar: Array,
			ariaInvalid: Boolean,
		},
		template: '<div />',
	},
}))
vi.mock('@/components/InlineEdit/VideoLinkDialog.vue', () => ({
	default: {
		name: 'VideoLinkDialog',
		props: ['open', 'modelValue'],
		template: '<div />',
	},
}))
vi.mock('@framework/ui/telemetry/index', () => ({}))
const { resized } = vi.hoisted(() => ({
	resized: [] as ((entries: { contentRect: { width: number } }[]) => void)[],
}))
vi.mock('@vueuse/core', async (original) => ({
	...(await original<typeof import('@vueuse/core')>()),
	useResizeObserver: (_target: unknown, callback: typeof resized[0]) =>
		resized.push(callback),
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({}))

import DraftCourseOutline from '@/components/Courses/DraftCourseOutline.vue'
import InlineText from '@/components/InlineEdit/InlineText.vue'
import PriceField from '@/components/InlineEdit/PriceField.vue'
import PriceInput from '@/components/InlineEdit/PriceInput.vue'
import RichTextField from '@/components/InlineEdit/RichTextField.vue'

const options = {
	global: { mocks: { __: globalThis.__ }, stubs: { Link: true } },
}

describe('the inline text field', () => {
	it('shows no border until focused and rings when missing', async () => {
		const wrapper = mount(InlineText, {
			props: { modelValue: 'Data', placeholder: 'Title' },
		})
		const field = wrapper.get('textarea')
		expect(field.classes()).toEqual(
			expect.arrayContaining([
				'border-transparent',
				'focus:border-outline-gray-4',
			])
		)
		expect(field.classes()).not.toContain('border-outline-gray-2')
		expect(field.classes()).not.toContain('ring-outline-red-3')
		await wrapper.setProps({ missing: true })
		expect(field.classes()).toContain('ring-outline-red-3')
	})

	it('hands Enter to the next field instead of a newline', async () => {
		const wrapper = mount(InlineText, { props: { placeholder: 'Title' } })
		await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
		expect(wrapper.emitted('enter')).toHaveLength(1)
	})

	it('refits its height when its width changes', () => {
		const wrapper = mount(InlineText, {
			props: { modelValue: 'A long title', placeholder: 'Title' },
		})
		const field = wrapper.get('textarea').element
		Object.defineProperty(field, 'scrollHeight', { value: 33 })
		resized.at(-1)!([{ contentRect: { width: 800 } }])
		expect(field.style.height).toBe('35px')
		field.style.height = '64px'
		resized.at(-1)!([{ contentRect: { width: 800 } }])
		expect(field.style.height).toBe('64px')
	})
})

describe('the draft course outline', () => {
	const mountOutline = () =>
		mount(DraftCourseOutline, {
			props: { modelValue: [{ title: 'Basics', lessons: ['Setup'] }] },
			...options,
		})

	it('fills the whole row on hover and focus, with no field outline', () => {
		const wrapper = mountOutline()
		for (const field of wrapper.findAll('textarea')) {
			expect(field.classes()).toEqual(
				expect.arrayContaining(['border-0', 'px-0', 'focus:ring-0'])
			)
			expect(field.classes()).not.toContain('focus:border-outline-gray-4')
			expect(field.element.parentElement!.className).toContain(
				'focus-within:bg-surface-gray-2'
			)
		}
	})

	it('adds a lesson from the chapter row', async () => {
		const wrapper = mountOutline()
		await wrapper.get('[aria-label="Add lesson to chapter 1"]').trigger('click')
		expect(wrapper.findAll('[data-testid=draft-lesson]')).toHaveLength(2)
	})
})

describe('the price field', () => {
	const mountPrice = (props: Record<string, unknown>) =>
		mount(PriceField, { props: { label: 'Price', ...props }, ...options })

	it('reads Free once and hides the amount until paid', () => {
		const wrapper = mountPrice({ paid: false })
		// The name starts with the visible choice, for 2.5.3.
		expect(wrapper.get('button').text()).toBe('Free, Price')
		expect(wrapper.get('button').attributes()).not.toHaveProperty('aria-label')
		expect(wrapper.findComponent(PriceInput).exists()).toBe(false)
	})

	it('asks the parent to switch to paid from the price menu', async () => {
		const wrapper = mountPrice({ paid: false })
		await wrapper.get('[data-testid="option-Paid"]').trigger('click')
		expect(wrapper.emitted('update:paid')).toEqual([[true]])
	})

	it('names the choice in its menu and leaves the price to the field', () => {
		const wrapper = mountPrice({ paid: true, currency: 'INR', amount: 500 })
		expect(wrapper.findComponent(PriceInput).props('amount')).toBe(500)
		expect(wrapper.get('button').text()).toBe('Paid, Price')
		const free = mountPrice({ paid: false })
		expect(free.get('button').text()).toBe('Free, Price')
	})

	it('emits the amount as a number', async () => {
		const wrapper = mount(PriceInput, options)
		await wrapper
			.findComponent({ name: 'FormControl' })
			.vm.$emit('update:modelValue', '42')
		expect(wrapper.emitted('update:amount')).toEqual([[42]])
	})
})

describe('the rich text field', () => {
	it('uses the inline editor with a focus-only toolbar', () => {
		const wrapper = mount(RichTextField, {
			props: { placeholder: 'About', ariaLabelledby: 'about', missing: true },
			...options,
		})
		const editor = wrapper.findComponent({ name: 'RichTextEditor' })
		expect(editor.props('variant')).toBe('inline')
		expect(editor.props('menuOnFocus')).toBe(true)
		expect(editor.props('toolbar').length).toBeGreaterThan(5)
		expect(editor.props('ariaInvalid')).toBe(true)
		expect(editor.classes()).toContain('ring-outline-red-3')
	})
})
