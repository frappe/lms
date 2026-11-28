import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'

vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.mock('frappe-ui', () => ({
	Badge: { template: '<span><slot /><slot name="suffix" /></span>' },
	Button: {
		props: ['disabled', 'variant'],
		template: '<button :disabled="disabled"><slot /></button>',
	},
	Dropdown: {
		name: 'Dropdown',
		props: ['options'],
		template: '<div><slot /></div>',
	},
	FormControl: {
		name: 'FormControl',
		props: ['variant'],
		template: '<input />',
	},
	Select: {
		name: 'Select',
		props: ['modelValue', 'options', 'variant'],
		template: '<div />',
	},
	MultiSelect: { template: '<div><slot name="trigger" /></div>' },
	Tooltip: {
		name: 'Tooltip',
		props: ['text'],
		template: '<div><slot /></div>',
	},
	createResource: () => ({ data: null, reload: vi.fn(), submit: vi.fn() }),
	toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('@framework/ui/telemetry/index', () => ({}))
const payments = vi.hoisted(() => ({ installed: true }))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: { data: { is_payments_app_installed: payments.installed } },
	}),
}))
vi.mock('@/components/PaymentsAppDialog.vue', () => ({
	default: {
		name: 'PaymentsAppDialog',
		props: ['modelValue'],
		template: '<div />',
	},
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({}))

import CourseCertificateBox from '@/components/Courses/CourseCertificateBox.vue'
import CourseSaveButton from '@/components/Courses/CourseSaveButton.vue'
import CourseTagsField from '@/components/Courses/CourseTagsField.vue'
import PriceInput from '@/components/InlineEdit/PriceInput.vue'
import { joinLabels, missingCourseFields } from '@/utils/courseForm'
import type { CourseForm } from '@/composables/useCourseForm'

const fullDoc = {
	title: 'Data',
	short_introduction: 'Learn data',
	description: '<p>All about data</p>',
	paid_course: 0,
	paid_certificate: 0,
}

function formWith(doc: Record<string, unknown>, dirty = true) {
	const showRequired = ref(false)
	const missingFields = computed(() =>
		missingCourseFields({ doc: doc as never, instructors: [] })
	)
	return {
		resource: reactive({ doc, setValue: { loading: false } }),
		markDirty: vi.fn(),
		isDirty: ref(dirty),
		showRequired,
		missingFields,
		isMissing: (key: string) =>
			showRequired.value && missingFields.value.some((f) => f.key === key),
		submitCourse: vi.fn(),
	} as unknown as CourseForm
}

const mountWithForm = (component: unknown, form: CourseForm, props = {}) =>
	mount(component as never, {
		props,
		global: {
			mocks: { __: globalThis.__ },
			provide: { courseForm: form },
			stubs: { Link: true, 'router-link': true },
		},
	})

describe('missing course fields', () => {
	it('names every empty required field, price only when charging', () => {
		const missing = missingCourseFields({
			doc: { paid_course: 1 } as never,
			instructors: [],
		})
		expect(missing.map((f) => f.key)).toEqual([
			'title',
			'short_introduction',
			'description',
			'instructors',
			'price',
		])
		expect(
			missingCourseFields({ doc: fullDoc as never, instructors: ['a'] })
		).toEqual([])
	})

	it('joins labels into one sentence', () => {
		expect(joinLabels(['a title'])).toBe('a title')
		expect(joinLabels(['a', 'b', 'c'])).toBe('a, b and c')
	})
})

describe('the Save button', () => {
	it('rings the empty fields while hovered and names them', async () => {
		const form = formWith({ ...fullDoc, title: '' })
		const wrapper = mountWithForm(CourseSaveButton, form, { form })

		await wrapper.find('span.inline-flex').trigger('mouseenter')
		expect(form.showRequired.value).toBe(true)
		expect(form.isMissing('title')).toBe(true)
		const tooltip = wrapper.findComponent({ name: 'Tooltip' })
		expect(tooltip.props('text')).toContain('a title')

		await wrapper.find('span.inline-flex').trigger('mouseleave')
		expect(form.showRequired.value).toBe(false)
	})

	it('keeps the rings after a save with gaps', async () => {
		const form = formWith({ ...fullDoc, title: '' })
		const wrapper = mountWithForm(CourseSaveButton, form, { form })
		await wrapper.find('span.inline-flex').trigger('mouseenter')
		await wrapper.find('button').trigger('click')
		await wrapper.find('span.inline-flex').trigger('mouseleave')
		expect(form.submitCourse).toHaveBeenCalled()
		expect(form.showRequired.value).toBe(true)
	})

	it('is disabled until something changes', () => {
		const form = formWith(fullDoc, false)
		const wrapper = mountWithForm(CourseSaveButton, form, { form })
		expect(wrapper.find('button').attributes('disabled')).toBeDefined()
	})
})

describe('the certificate box', () => {
	const select = (wrapper: ReturnType<typeof mountWithForm>) =>
		wrapper.findComponent({ name: 'Select' })

	it('offers only a free certificate on a paid course', () => {
		const form = formWith({ ...fullDoc, paid_course: 1 })
		const wrapper = mountWithForm(CourseCertificateBox, form)
		expect(select(wrapper).props('variant')).toBe('ghost')
		expect(
			select(wrapper)
				.props('options')
				.map((o: { label: string }) => o.label)
		).toEqual(['None', 'Free'])
	})

	it('sets the flags for a paid certificate', async () => {
		const doc: Record<string, unknown> = { ...fullDoc, enable_certification: 1 }
		const form = formWith(doc)
		const wrapper = mountWithForm(CourseCertificateBox, form)
		await select(wrapper).vm.$emit('update:modelValue', 'paid')
		expect(doc.paid_certificate).toBe(1)
		expect(doc.enable_certification).toBe(0)
		expect(form.markDirty).toHaveBeenCalled()
		expect(wrapper.findComponent(PriceInput).exists()).toBe(true)
	})

	it('asks for the Payments app before selling a certificate', async () => {
		const doc: Record<string, unknown> = { ...fullDoc }
		payments.installed = false
		try {
			const wrapper = mountWithForm(CourseCertificateBox, formWith(doc))
			await select(wrapper).vm.$emit('update:modelValue', 'paid')
			expect(doc.paid_certificate).toBe(0)
			expect(
				wrapper.findComponent({ name: 'PaymentsAppDialog' }).props('modelValue')
			).toBe(true)
		} finally {
			payments.installed = true
		}
	})

	// The ghost price field and settings link bleed by their padding, so their
	// prefix icons share the box's content edge with the label icon.
	it('lines every row icon up on the box content edge', () => {
		const wrapper = mount(CourseCertificateBox as never, {
			global: {
				mocks: { __: globalThis.__ },
				provide: {
					courseForm: formWith({ ...fullDoc, paid_certificate: 1 }),
				},
				stubs: { Link: true, 'router-link': { template: '<a><slot /></a>' } },
			},
		})
		const rows = [
			wrapper.find('.lucide-award'),
			wrapper.find('.lucide-user-check'),
		]
		for (const icon of rows) {
			expect(icon.classes()).toContain('size-4')
			expect(icon.element.parentElement?.className).toMatch(/\bgap-2\b/)
		}
		expect(rows[0].element.parentElement?.className).not.toMatch(/\bps-2\b/)
		expect(wrapper.find('a').classes()).toEqual(
			expect.arrayContaining(['-mx-2', 'px-2'])
		)
		expect(wrapper.findComponent({ name: 'PriceInput' }).classes()).toContain(
			'-mx-2'
		)
	})
})

// Regression: currency picker 403 for Moderator and Course Creator, LMS roles
// cannot read Currency (#3023, fixed in #3038).
describe('the price input', () => {
	it('searches currencies through the LMS query', () => {
		const wrapper = mountWithForm(PriceInput, formWith(fullDoc))
		const picker = wrapper
			.findAllComponents({ name: 'Link' })
			.find((link) => link.props('doctype') === 'Currency')
		expect(picker?.props('query')).toBe('lms.lms.api.search_currencies')
	})
})

describe('the tags field', () => {
	it('removes a tag from its chip and marks the form dirty', async () => {
		const doc: Record<string, unknown> = { ...fullDoc, tags: 'sql, python' }
		const form = formWith(doc)
		const wrapper = mountWithForm(CourseTagsField, form)
		await wrapper.find('[aria-label="Remove tag sql"]').trigger('click')
		expect(doc.tags).toBe('python')
		expect(form.markDirty).toHaveBeenCalled()
	})
})
