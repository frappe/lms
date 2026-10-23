import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	config,
	enableAutoUnmount,
	flushPromises,
	mount,
} from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

config.global.mocks = { __: translate }

const { callMock } = vi.hoisted(() => ({ callMock: vi.fn() }))

vi.mock('frappe-ui', () => ({
	call: callMock,
	Switch: {
		name: 'SwitchStub',
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template: `<button type="button" data-testid="switch-toggle" :aria-checked="String(Boolean(modelValue))" @click="$emit('update:modelValue', !modelValue)" />`,
	},
	Badge: {
		props: ['label', 'theme', 'variant'],
		template: `<span data-testid="badge" :data-theme="theme" :data-variant="variant">{{ label }}</span>`,
	},
	Button: {
		inheritAttrs: false,
		props: ['icon', 'label', 'variant', 'theme'],
		emits: ['click'],
		template: `<button v-bind="$attrs" :data-variant="variant" :data-theme="theme" @click="$emit('click')"><span v-if="icon" :class="icon" />{{ label }}<slot name="icon" /><slot /></button>`,
	},
	Avatar: {
		props: ['image', 'label'],
		template: `<span data-testid="avatar" />`,
	},
	FormControl: {
		inheritAttrs: false,
		props: ['modelValue', 'label', 'type', 'placeholder', 'required', 'error'],
		emits: ['update:modelValue'],
		template: `<label :data-field="label" :data-value="modelValue" :data-required="String(!!required)" :data-error="error">{{ label }}<input :value="modelValue" :placeholder="placeholder" :aria-invalid="error ? 'true' : undefined" :aria-label="$attrs['aria-label']" :aria-describedby="$attrs['aria-describedby']" @input="$emit('update:modelValue', type === 'number' ? ($event.target.value === '' ? '' : Number($event.target.value)) : $event.target.value)" /></label>`,
	},
	TabButtons: {
		props: ['modelValue', 'options'],
		emits: ['update:modelValue'],
		template: `<div data-testid="tabs"><button v-for="o in options" :key="o.value" type="button" :data-value="o.value" @click="$emit('update:modelValue', o.value)">{{ o.label }}</button></div>`,
	},
	Select: {
		props: ['modelValue', 'options'],
		emits: ['update:modelValue'],
		template: `<select data-testid="payment-select" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>`,
	},
	ErrorMessage: {
		props: ['message'],
		template: `<div role="alert" data-testid="error">{{ message }}</div>`,
	},
	Tooltip: {
		props: ['text'],
		template: `<span :data-tooltip="text"><slot /></span>`,
	},
	Checkbox: {
		props: ['modelValue', 'disabled'],
		template: `<input type="checkbox" data-testid="checkbox" :checked="modelValue" :disabled="disabled" />`,
	},
}))

vi.mock('@/components/Controls/Link.vue', () => ({
	default: defineComponent({
		props: [
			'doctype',
			'modelValue',
			'label',
			'required',
			'error',
			'placeholder',
			'query',
			'filters',
		],
		emits: ['update:modelValue'],
		render() {
			return h('input', {
				'data-testid': `link-${this.doctype}`,
				'data-query': this.query,
				'data-filters': JSON.stringify(this.filters),
				'data-field': this.label,
				'data-value': this.modelValue,
				'data-required': String(!!this.required),
				'data-error': this.error,
				'aria-invalid': this.error ? 'true' : undefined,
				value: this.modelValue,
				placeholder: this.placeholder,
				onInput: (e: Event) =>
					this.$emit('update:modelValue', (e.target as HTMLInputElement).value),
			})
		},
	}),
}))

const screen = vi.hoisted(() => ({ mobile: false }))

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		useScreenSize: () => ({
			size: { width: 1024, height: 800 },
			isMobile: computed(() => screen.mobile),
		}),
	}
})

vi.mock('@/components/Enrollment/StudentPicker.vue', () => ({
	default: defineComponent({
		props: ['modelValue', 'enrollDoctype', 'enrollDocname', 'includeEnrolled'],
		render() {
			return h(
				'div',
				{
					'data-testid': 'picker',
					'data-include-enrolled': String(this.includeEnrolled),
				},
				[
					h('div', { 'data-testid': 'picker-input' }),
					this.$slots.beforeList?.(),
					h(
						'ul',
						{ 'data-testid': 'picker-list' },
						this.$slots.list?.({
							students: [{ value: 'a@x.com', label: 'A', image: null }],
							remove: () => {},
						})
					),
				]
			)
		},
	}),
}))

import EnrollSelectStep from '@/components/Enrollment/EnrollSelectStep.vue'
import EnrollStudentTable from '@/components/Enrollment/EnrollStudentTable.vue'
import EnrollPaymentPanel from '@/components/Enrollment/EnrollPaymentPanel.vue'
import EnrollSelectionBanner from '@/components/Enrollment/EnrollSelectionBanner.vue'
import { emptyAddress, emptyOverride } from '@/components/Enrollment/enrollment'
import type {
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
	PaymentChoice,
	PaymentDefaults,
	PaymentOverride,
	StudentRow,
} from '@/types'

const target = (overrides: Partial<EnrollTarget> = {}): EnrollTarget => ({
	doctype: 'LMS Course',
	name: 'c1',
	paidKind: null,
	priceLabel: null,
	...overrides,
})

const row = (
	member: string,
	status: EnrollStatus = 'ready',
	extra: Partial<EnrollPreviewRow> = {}
): EnrollPreviewRow => ({
	member,
	full_name: null,
	user_image: null,
	status,
	linkable_payments: [],
	...extra,
})

describe('EnrollSelectStep', () => {
	it('shows no paid switch for a free target', () => {
		const wrapper = mount(EnrollSelectStep, {
			props: { target: target(), members: [], paid: false },
		})
		expect(wrapper.find('[data-testid="switch"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="picker"]').exists()).toBe(true)
	})

	it('shows the certificate switch and searches enrolled students while on', async () => {
		const wrapper = mount(EnrollSelectStep, {
			props: {
				target: target({ paidKind: 'certificate', priceLabel: '₹999' }),
				members: [],
				paid: false,
				'onUpdate:paid': (value: boolean) => wrapper.setProps({ paid: value }),
			},
		})
		const text = wrapper.text()
		expect(text).toContain('Include paid certificate')
		expect(text).toContain(
			'Students get the certificate and a payment is recorded for each. Certificate price ₹999.'
		)
		expect(
			wrapper.get('[data-testid="picker"]').attributes('data-include-enrolled')
		).toBe('false')
		await wrapper.get('[data-testid="switch-toggle"]').trigger('click')
		expect(
			wrapper.get('[data-testid="picker"]').attributes('data-include-enrolled')
		).toBe('true')
	})

	it('puts the paid switch under the picker, above the selected list', () => {
		const wrapper = mount(EnrollSelectStep, {
			props: {
				target: target({ paidKind: 'course' }),
				members: [],
				paid: true,
			},
		})
		const picker = wrapper.get('[data-testid="picker"]').element
		const children = Array.from(picker.children).map(
			(el) => el.getAttribute('data-testid') ?? ''
		)
		expect(children).toEqual(['picker-input', 'switch', 'picker-list'])
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): with no price the
	// switch description still carried an empty price sentence.
	it('words the batch switch and drops the price sentence without a price', () => {
		const wrapper = mount(EnrollSelectStep, {
			props: {
				target: target({ paidKind: 'batch', priceLabel: null }),
				members: [],
				paid: true,
			},
		})
		expect(wrapper.get('[data-testid="switch-label"]').text()).toBe(
			'Record payments'
		)
		const description = wrapper.get('[data-testid="switch-description"]')
		expect(description.text()).toBe(
			'Turn off to enroll without a payment record.'
		)
		const toggle = wrapper.get('[data-testid="switch-toggle"]')
		expect(toggle.attributes('aria-describedby')).toBe(
			description.attributes('id')
		)
		expect(toggle.attributes('aria-labelledby')).toBe(
			wrapper.get('[data-testid="switch-label"]').attributes('id')
		)
	})
	it('hands the picker list slot through to the caller', () => {
		const wrapper = mount(EnrollSelectStep, {
			props: { target: target(), members: [], paid: false },
			slots: {
				list: `<template #list="{ students }"><li data-testid="slotted">{{ students.length }}</li></template>`,
			},
		})
		expect(wrapper.get('[data-testid="slotted"]').text()).toBe('1')
	})
})

const studentRow = (
	member: string,
	extra: Partial<StudentRow> = {}
): StudentRow => ({
	member,
	name: member,
	image: null,
	payment: '₹100.00 · Website',
	billing: '—',
	needsAddress: false,
	incomplete: false,
	badge: null,
	...extra,
})

describe('EnrollStudentTable', () => {
	const mountTable = (
		rows: StudentRow[],
		extra: Partial<{ paid: boolean; compact: boolean; ticked: string[] }> = {}
	) => {
		const wrapper = mount(EnrollStudentTable, {
			props: {
				rows,
				paid: true,
				compact: false,
				ticked: [],
				'onUpdate:ticked': (value: string[]) =>
					wrapper.setProps({ ticked: value }),
				...extra,
			},
		})
		return wrapper
	}

	const headers = (wrapper: ReturnType<typeof mountTable>) =>
		wrapper.findAll('[data-slot="list-header-cell"]').map((cell) => cell.text())

	it('shows a Requires address badge in Billing for a row with no address', () => {
		const wrapper = mountTable([
			studentRow('a@x.com', { needsAddress: true }),
			studentRow('b@x.com', { billing: '—' }),
		])
		const [needs, linked] = wrapper
			.findAll('[data-testid="student-row"]')
			.map((row) => row.get('[data-col="billing"]'))
		const badge = needs.get('[data-testid="requires-address-badge"]')
		expect(badge.text()).toBe('Requires address')
		expect(badge.attributes('data-variant')).toBe('outline')
		expect(needs.text()).toBe('Requires address')
		expect(linked.text()).toBe('—')
	})

	it('shows Student, Payment and Billing while payments are on', () => {
		const wrapper = mountTable([
			studentRow('a@x.com', { name: 'Jane Doe', billing: 'Pune, India' }),
		])
		expect(headers(wrapper)).toEqual(['Student', 'Payment', 'Billing'])
		const row = wrapper.get('[data-testid="student-row"]')
		expect(row.get('[data-testid="student-sub"]').text()).toBe('a@x.com')
		expect(row.get('[data-col="payment"]').text()).toBe('₹100.00 · Website')
		expect(row.get('[data-col="billing"]').text()).toBe('Pune, India')
		expect(row.find('[data-testid="requires-address-badge"]').exists()).toBe(
			false
		)
		expect(row.find('[data-slot="list-row-checkbox"]').exists()).toBe(true)
		expect(row.find('.lucide-trash-2').exists()).toBe(false)
	})

	it('shows Student and Email with checkboxes while payments are off', () => {
		const wrapper = mountTable([studentRow('a@x.com', { badge: 'New' })], {
			paid: false,
		})
		expect(headers(wrapper)).toEqual(['Student', 'Email'])
		expect(wrapper.find('[data-slot="list-row-checkbox"]').exists()).toBe(true)
		const badge = wrapper.get('[data-testid="badge"]')
		expect([badge.text(), badge.attributes('data-variant')]).toEqual([
			'New',
			'outline',
		])
	})

	it('narrows to the student with the payment under the name and an Incomplete badge', () => {
		const wrapper = mountTable(
			[studentRow('a@x.com', { incomplete: true }), studentRow('b@x.com')],
			{ compact: true }
		)
		expect(headers(wrapper)).toEqual(['Student', 'Status'])
		const [first, second] = wrapper.findAll('[data-testid="student-row"]')
		expect(first.get('[data-testid="student-sub"]').text()).toBe(
			'₹100.00 · Website'
		)
		const badge = first.get('[data-testid="incomplete-badge"]')
		expect(badge.text()).toBe('Incomplete')
		expect(badge.attributes('data-theme')).toBe('red')
		expect(badge.attributes('data-variant')).toBe('outline')
		expect(second.find('[data-testid="incomplete-badge"]').exists()).toBe(false)
		expect(wrapper.find('[data-col="payment"]').exists()).toBe(false)
	})

	it('ticks rows with a mixed select-all and keeps the column headers', async () => {
		const wrapper = mountTable([studentRow('a@x.com'), studentRow('b@x.com')])
		await wrapper
			.get('[data-member="a@x.com"] [data-slot="list-row-checkbox"]')
			.trigger('click')
		expect(wrapper.emitted('update:ticked')?.at(-1)).toEqual([['a@x.com']])
		expect(headers(wrapper)).toEqual(['Student', 'Payment', 'Billing'])
		expect(
			wrapper
				.get('[data-slot="list-header-checkbox"]')
				.attributes('aria-checked')
		).toBe('mixed')
		await wrapper.get('[data-slot="list-header-checkbox"]').trigger('click')
		expect(wrapper.emitted('update:ticked')?.at(-1)).toEqual([
			['a@x.com', 'b@x.com'],
		])
	})

	const banner = (wrapper: ReturnType<typeof mountTable>) =>
		wrapper.find('[data-testid="selection-banner"]')
	const scroller = (wrapper: ReturnType<typeof mountTable>) =>
		wrapper.get('[data-testid="student-table"]')

	it('shows the selection banner over the list only while rows are ticked', async () => {
		const wrapper = mountTable([studentRow('a@x.com'), studentRow('b@x.com')], {
			paid: false,
		})
		expect(banner(wrapper).exists()).toBe(false)
		expect(scroller(wrapper).classes()).not.toContain('pb-20')
		await wrapper
			.get('[data-member="a@x.com"] [data-slot="list-row-checkbox"]')
			.trigger('click')
		expect(banner(wrapper).text()).toContain('1 student selected')
		expect(scroller(wrapper).classes()).toContain('pb-20')
		expect(banner(wrapper).classes()).toContain('absolute')
		expect(scroller(wrapper).element.contains(banner(wrapper).element)).toBe(
			false
		)
		expect(scroller(wrapper).element.parentElement?.classList).toContain(
			'relative'
		)
	})

	it('asks to remove or reset the ticked students from the banner', async () => {
		const wrapper = mountTable(
			[studentRow('a@x.com'), studentRow('b@x.com'), studentRow('c@x.com')],
			{ ticked: ['a@x.com', 'c@x.com'] }
		)
		await wrapper.get('[data-testid="selection-remove"]').trigger('click')
		await wrapper.get('[data-testid="selection-reset"]').trigger('click')
		expect(wrapper.emitted('remove')).toEqual([[['a@x.com', 'c@x.com']]])
		expect(wrapper.emitted('reset')).toEqual([[['a@x.com', 'c@x.com']]])
	})

	it('Select all in the banner ticks every student', async () => {
		const wrapper = mountTable([studentRow('a@x.com'), studentRow('b@x.com')], {
			ticked: ['b@x.com'],
		})
		await wrapper.get('[data-testid="selection-select-all"]').trigger('click')
		expect(wrapper.emitted('update:ticked')?.at(-1)).toEqual([
			['a@x.com', 'b@x.com'],
		])
		expect(banner(wrapper).text()).toContain('2 students selected')
	})

	it('the banner x clears the selection and focuses the select-all checkbox', async () => {
		const wrapper = mount(EnrollStudentTable, {
			props: {
				rows: [studentRow('a@x.com'), studentRow('b@x.com')],
				paid: true,
				compact: false,
				ticked: ['a@x.com'],
				'onUpdate:ticked': (value: string[]) =>
					wrapper.setProps({ ticked: value }),
			},
			attachTo: document.body,
		})
		await wrapper.get('[data-testid="selection-clear"]').trigger('click')
		await flushPromises()
		expect(wrapper.emitted('update:ticked')?.at(-1)).toEqual([[]])
		expect(banner(wrapper).exists()).toBe(false)
		expect(document.activeElement).toBe(
			wrapper.get('[data-slot="list-header-checkbox"]').element
		)
	})
})

describe('EnrollSelectionBanner', () => {
	const mountBanner = (props: {
		count: number
		total: number
		paid: boolean
	}) => mount(EnrollSelectionBanner, { props })

	const get = (wrapper: ReturnType<typeof mountBanner>, id: string) =>
		wrapper.get(`[data-testid="${id}"]`)

	it('renders nothing visible and announces nothing with no selection', () => {
		const wrapper = mountBanner({ count: 0, total: 3, paid: true })
		expect(wrapper.find('[data-testid="selection-banner"]').exists()).toBe(
			false
		)
		expect(wrapper.get('[role="status"]').text()).toBe('')
	})

	it('names the count in the pill and in a polite live region', async () => {
		const wrapper = mountBanner({ count: 1, total: 3, paid: true })
		expect(get(wrapper, 'selection-count').text()).toBe('1 student selected')
		await wrapper.setProps({ count: 2 })
		expect(get(wrapper, 'selection-count').text()).toBe('2 students selected')
		const live = wrapper.get('[role="status"]')
		expect(live.attributes('aria-live')).toBe('polite')
		expect(live.text()).toBe('2 students selected')
		const region = get(wrapper, 'selection-banner')
		expect(region.attributes('role')).toBe('region')
		expect(region.attributes('aria-label')).toBe('Selected students')
	})

	it('labels each icon button and its tooltip with the same text', () => {
		const wrapper = mountBanner({ count: 1, total: 3, paid: true })
		for (const [id, label, icon] of [
			[
				'selection-reset',
				'Reset details for selected students',
				'lucide-rotate-ccw',
			],
			['selection-remove', 'Remove selected students', 'lucide-trash-2'],
			['selection-clear', 'Clear selection', 'lucide-x'],
		]) {
			const button = get(wrapper, id)
			expect(button.attributes('aria-label')).toBe(label)
			expect(button.element.parentElement?.dataset.tooltip).toBe(label)
			expect(button.find(`.${icon}`).exists()).toBe(true)
			expect(button.text()).toBe('')
		}
		expect(get(wrapper, 'selection-select-all').text()).toBe('Select all')
	})

	it('offers reset only while payments are on', () => {
		const wrapper = mountBanner({ count: 1, total: 3, paid: false })
		expect(wrapper.find('[data-testid="selection-reset"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="selection-remove"]').exists()).toBe(true)
	})

	it('emits remove, reset, selectAll and clear', async () => {
		const wrapper = mountBanner({ count: 1, total: 3, paid: true })
		for (const id of [
			'selection-remove',
			'selection-reset',
			'selection-select-all',
			'selection-clear',
		]) {
			await get(wrapper, id).trigger('click')
		}
		expect(Object.keys(wrapper.emitted())).toEqual(
			expect.arrayContaining(['remove', 'reset', 'selectAll', 'clear'])
		)
	})

	it('Select all does nothing once every student is ticked', async () => {
		const wrapper = mountBanner({ count: 3, total: 3, paid: true })
		const all = get(wrapper, 'selection-select-all')
		expect(all.attributes('aria-disabled')).toBe('true')
		await all.trigger('click')
		expect(wrapper.emitted('selectAll')).toBeUndefined()
	})
})

describe('EnrollPaymentPanel', () => {
	const defaults = (): PaymentDefaults => ({
		amount: 999,
		currency: 'INR',
		source: null,
		address: null,
	})
	const linkable = [
		{
			name: 'P1',
			amount: 999,
			currency: 'INR',
			creation: '2026-01-02 10:00:00',
		},
	]

	const mountPanel = (
		rows: EnrollPreviewRow[],
		models: Partial<{
			defaults: PaymentDefaults
			choices: Record<string, PaymentChoice>
			overrides: Record<string, PaymentOverride>
			showBack: boolean
		}> = {}
	) => {
		const wrapper = mount(EnrollPaymentPanel, {
			props: {
				rows,
				total: 3,
				showBack: models.showBack ?? false,
				defaults: models.defaults ?? defaults(),
				choices: models.choices ?? {},
				overrides: models.overrides ?? {},
				'onUpdate:defaults': (value: PaymentDefaults) =>
					wrapper.setProps({ defaults: value }),
				'onUpdate:choices': (value: Record<string, PaymentChoice>) =>
					wrapper.setProps({ choices: value }),
				'onUpdate:overrides': (value: Record<string, PaymentOverride>) =>
					wrapper.setProps({ overrides: value }),
			},
		})
		return wrapper
	}

	type Wrapper = ReturnType<typeof mountPanel>

	const field = (wrapper: Wrapper, label: string) =>
		wrapper.get(`[data-field="${label}"]`)
	const input = (wrapper: Wrapper, label: string) => {
		const el = field(wrapper, label)
		return el.element.tagName === 'INPUT' ? el : el.get('input')
	}
	const lastOverrides = (wrapper: Wrapper) =>
		(
			wrapper.emitted('update:overrides') as Record<string, PaymentOverride>[][]
		).at(-1)?.[0]
	const text = (wrapper: Wrapper, id: string) =>
		wrapper.get(`[data-testid="${id}"]`).text()

	it('with nothing ticked, edits the details for all', async () => {
		const wrapper = mountPanel([])
		expect(text(wrapper, 'panel-title')).toBe('Details for all 3 students')
		expect(has(wrapper, 'panel-helper')).toBe(false)
		expect(field(wrapper, 'Amount').attributes('data-required')).toBe('true')
		expect(field(wrapper, 'Source').attributes('data-required')).toBe('false')
		expect((input(wrapper, 'Amount').element as HTMLInputElement).value).toBe(
			'999'
		)
		expect((input(wrapper, 'Currency').element as HTMLInputElement).value).toBe(
			'INR'
		)
		expect(wrapper.find('[data-field="Billing name"]').exists()).toBe(false)
		await input(wrapper, 'Amount').setValue('50')
		await input(wrapper, 'Source').setValue('Web')
		const events = wrapper.emitted('update:defaults') as PaymentDefaults[][]
		expect(events.at(-1)?.[0]).toMatchObject({ amount: 50, source: 'Web' })
		expect(wrapper.emitted('update:overrides')).toBeUndefined()
	})

	const named = (wrapper: Wrapper, name: string) =>
		wrapper.get(`input[aria-label="${name}"]`)
	const has = (wrapper: Wrapper, id: string) =>
		wrapper.find(`[data-testid="${id}"]`).exists()
	const press = (wrapper: Wrapper, id: string) =>
		wrapper.get(`[data-testid="${id}"]`).trigger('click')

	it('shows the address fields by default and clearing them means no address', async () => {
		const wrapper = mountPanel([])
		expect(wrapper.text()).toContain('Billing address')
		expect(wrapper.text()).not.toContain('optional')
		expect(wrapper.find('[data-testid="tabs"]').exists()).toBe(false)
		expect(has(wrapper, 'address-add')).toBe(false)
		expect(has(wrapper, 'address-remove')).toBe(false)
		expect(has(wrapper, 'address-use-existing')).toBe(true)
		const names = wrapper
			.get('[data-testid="address-fields"]')
			.findAll('input')
			.map((el) => el.attributes('aria-label'))
		expect(names).toEqual([
			'Address line 1',
			'City',
			'Country',
			'Address line 2',
			'State',
			'Postal code',
		])
		const fields = wrapper.get('[data-testid="address-fields"]').element
		const halves = Array.from(fields.children).map((cell) =>
			cell.classList.contains('col-span-2') ? 'full' : 'half'
		)
		expect(halves).toEqual(['full', 'half', 'half', 'full', 'half', 'half'])
		const requiredNames = () =>
			names.filter(
				(name) =>
					named(wrapper, name!)
						.element.closest('[data-required]')
						?.getAttribute('data-required') === 'true'
			)
		const COMPULSORY = ['Address line 1', 'City', 'Country']
		for (const name of names) {
			expect(named(wrapper, name!).attributes('placeholder')).toBe(
				COMPULSORY.includes(name!) ? `${name} *` : name
			)
		}
		expect(requiredNames()).toEqual(COMPULSORY)
		const group = wrapper.get('section[role="group"]')
		const heading = wrapper.get(`#${group.attributes('aria-labelledby')}`)
		expect(heading.text()).toMatch(/^Billing address/)
		expect(group.find('[data-testid="address-fields"]').exists()).toBe(true)
		await named(wrapper, 'City').setValue('Pune')
		const events = wrapper.emitted('update:defaults') as PaymentDefaults[][]
		expect(events.at(-1)?.[0].address).toEqual({
			...emptyAddress(),
			city: 'Pune',
		})
		expect(requiredNames()).toEqual(['Address line 1', 'City', 'Country'])
		expect(text(wrapper, 'missing-details')).toContain(
			'Address line 1, Country'
		)
		await input(wrapper, 'Phone').setValue('99')
		expect(events.at(-1)?.[0].address).toEqual({
			...emptyAddress(),
			city: 'Pune',
			phone: '99',
		})
		await input(wrapper, 'Phone').setValue('')
		await named(wrapper, 'City').setValue('')
		expect(events.at(-1)?.[0].address).toBeNull()
		expect(has(wrapper, 'address-fields')).toBe(true)
		expect(text(wrapper, 'missing-details')).toBe('Missing: Billing address')
		expect(requiredNames()).toEqual(COMPULSORY)
		expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(false)
	})

	it('flags each empty compulsory field once asked, until it is filled', async () => {
		const wrapper = mountPanel([], {
			defaults: { ...defaults(), amount: null },
		})
		const invalid = () =>
			wrapper
				.findAll('[aria-invalid="true"]')
				.map(
					(el) =>
						el.attributes('aria-label') ??
						el.element.closest('[data-field]')?.getAttribute('data-field')
				)
		expect(invalid()).toEqual([])
		await wrapper.setProps({ flagMissing: true })
		expect(invalid()).toEqual(['Amount', 'Address line 1', 'City', 'Country'])
		await input(wrapper, 'Amount').setValue('5')
		expect(invalid()).toEqual(['Address line 1', 'City', 'Country'])
		await named(wrapper, 'City').setValue('Pune')
		expect(invalid()).toEqual(['Address line 1', 'Country'])
		await named(wrapper, 'Address line 1').setValue('1 Main St')
		await named(wrapper, 'Country').setValue('India')
		expect(invalid()).toEqual([])
		await named(wrapper, 'City').setValue('')
		expect(invalid()).toEqual(['City'])
		await wrapper.setProps({ flagMissing: false })
		expect(invalid()).toEqual([])
	})

	it('focusFirst goes to the first flagged field, else the first field', async () => {
		const flagged = mountPanel([], { defaults: { ...defaults(), amount: 5 } })
		await flagged.setProps({ flagMissing: true })
		document.body.appendChild(flagged.element)
		;(flagged.vm as unknown as { focusFirst: () => void }).focusFirst()
		expect(document.activeElement).toBe(
			named(flagged, 'Address line 1').element
		)

		const clean = mountPanel([], {
			defaults: { ...defaults(), address: { name: 'ADDR-1', summary: '' } },
		})
		document.body.appendChild(clean.element)
		;(clean.vm as unknown as { focusFirst: () => void }).focusFirst()
		expect(document.activeElement).toBe(input(clean, 'Amount').element)
		flagged.element.remove()
		clean.element.remove()
	})

	// Regression (bulk-enroll PR, feat/bulk-enroll): emptying an inherited
	// field refilled it with the common value straight away.
	it('a field emptied for ticked students stays empty, showing the common value as placeholder', async () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], {
			defaults: { ...defaults(), source: 'Web' },
		})
		for (const [label, common] of [
			['Amount', '999'],
			['Source', 'Web'],
		]) {
			await input(wrapper, label).setValue('')
			expect(field(wrapper, label).attributes('data-value')).toBe('')
			expect(
				(input(wrapper, label).element as HTMLInputElement).placeholder
			).toBe(common)
		}
		expect(lastOverrides(wrapper)?.['a@x.com']).toMatchObject({
			amount: null,
			source: null,
		})
		await input(wrapper, 'Amount').setValue('40')
		expect(field(wrapper, 'Amount').attributes('data-value')).toBe('40')
	})

	it('with one ticked, shows the common amount, currency and source as values', async () => {
		const wrapper = mountPanel(
			[row('a@x.com', 'ready', { full_name: 'Jane Doe' })],
			{ defaults: { ...defaults(), source: 'Web' } }
		)
		expect(text(wrapper, 'panel-title')).toBe('Jane Doe')
		expect(text(wrapper, 'panel-helper')).toBe(
			'Empty fields use the details for all.'
		)
		const labels = wrapper
			.findAll('[data-field]')
			.map((el) => el.attributes('data-field'))
		expect(labels.slice(0, 5)).toEqual([
			'Amount',
			'Currency',
			'Source',
			'Phone',
			'Billing name',
		])
		expect(
			(input(wrapper, 'Billing name').element as HTMLInputElement).placeholder
		).toBe('Jane Doe')
		const value = (label: string) =>
			(input(wrapper, label).element as HTMLInputElement).value
		expect([value('Amount'), value('Currency'), value('Source')]).toEqual([
			'999',
			'INR',
			'Web',
		])
		await input(wrapper, 'Source').setValue('Referral')
		expect(lastOverrides(wrapper)?.['a@x.com'].source).toBe('Referral')
		await input(wrapper, 'Source').setValue('Web')
		expect(lastOverrides(wrapper)?.['a@x.com'].source).toBeNull()
		await input(wrapper, 'Amount').setValue('10')
		expect(lastOverrides(wrapper)?.['a@x.com'].amount).toBe(10)
		await input(wrapper, 'Amount').setValue('999')
		expect(lastOverrides(wrapper)?.['a@x.com'].amount).toBeNull()
		await input(wrapper, 'Amount').setValue('')
		expect(lastOverrides(wrapper)?.['a@x.com'].amount).toBeNull()
		await input(wrapper, 'Currency').setValue('USD')
		expect(lastOverrides(wrapper)?.['a@x.com'].currency).toBe('USD')
		await input(wrapper, 'Currency').setValue('INR')
		expect(lastOverrides(wrapper)?.['a@x.com'].currency).toBeNull()
	})

	it('with several ticked, writes the same override to each of them', async () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], {
			overrides: { 'c@x.com': { ...emptyOverride(), amount: 7 } },
		})
		expect(text(wrapper, 'panel-title')).toBe('Details for 2 students')
		expect(text(wrapper, 'panel-helper')).toBe(
			'What you enter applies to these 2. Empty fields use the details for all.'
		)
		expect(
			(input(wrapper, 'Billing name').element as HTMLInputElement).placeholder
		).toBe("Each student's name")
		expect(
			wrapper.find('[data-testid="tabs"] [data-value="link"]').exists()
		).toBe(false)
		expect((input(wrapper, 'Amount').element as HTMLInputElement).value).toBe(
			'999'
		)
		await input(wrapper, 'Amount').setValue('40')
		await input(wrapper, 'Source').setValue('Referral')
		const overrides = lastOverrides(wrapper)!
		for (const member of ['a@x.com', 'b@x.com']) {
			expect(overrides[member]).toMatchObject({
				amount: 40,
				source: 'Referral',
			})
		}
		expect(overrides['c@x.com'].amount).toBe(7)
	})

	it('shows Varies where the ticked students differ', () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], {
			overrides: { 'a@x.com': { ...emptyOverride(), amount: 5 } },
		})
		const amount = input(wrapper, 'Amount').element as HTMLInputElement
		expect([amount.value, amount.placeholder]).toEqual(['', 'Varies'])
	})

	it('has no remove or reset of its own, the selection banner owns them', () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')])
		expect(wrapper.find('.lucide-trash-2').exists()).toBe(false)
		expect(wrapper.find('.lucide-rotate-ccw').exists()).toBe(false)
	})

	it('closes with the x, or goes back on mobile', async () => {
		const wrapper = mountPanel([])
		await wrapper.get('[data-testid="payment-panel-close"]').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(1)
		const mobile = mountPanel([], { showBack: true })
		expect(mobile.find('[data-testid="payment-panel-close"]').exists()).toBe(
			false
		)
		await mobile.get('[data-testid="payment-panel-back"]').trigger('click')
		expect(mobile.emitted('back')).toHaveLength(1)
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): the payment-mode
	// toggle had no accessible name. Keep the named group around it.
	it('offers Link existing only to one student with a payment to link', async () => {
		const bare = mountPanel([row('b@x.com')])
		expect(bare.find('[aria-label="Payment mode for b@x.com"]').exists()).toBe(
			false
		)
		const wrapper = mountPanel([
			row('a@x.com', 'ready', {
				full_name: 'Jane Doe',
				linkable_payments: linkable,
			}),
		])
		const group = wrapper.get(
			'[role="group"][aria-label="Payment mode for Jane Doe"]'
		)
		expect(group.text()).toContain('New payment')
		await group.get('[data-value="link"]').trigger('click')
		const events = wrapper.emitted('update:choices') as Record<
			string,
			PaymentChoice
		>[][]
		expect(events.at(-1)?.[0]['a@x.com']).toEqual({
			mode: 'link',
			payment: null,
		})
		expect(wrapper.find('[data-field="Amount"]').exists()).toBe(false)
		await wrapper.get('[data-testid="payment-select"]').setValue('P1')
		expect(
			(
				wrapper.emitted('update:choices') as Record<string, PaymentChoice>[][]
			).at(-1)?.[0]['a@x.com']
		).toEqual({ mode: 'link', payment: 'P1' })
	})

	const SAVED_ADDRESS = { name: 'ADDR-1', summary: 'Pune' }

	const common = {
		...emptyAddress(),
		address_line1: 'Andheri',
		city: 'Mumbai',
		country: 'India',
	}

	const fieldValue = (wrapper: Wrapper, name: string) =>
		(named(wrapper, name).element as HTMLInputElement).value

	it.each([
		['one', [row('a@x.com', 'ready', { full_name: 'Jane Doe' })]],
		['two', [row('a@x.com'), row('b@x.com')]],
	])(
		'with %s ticked and no own address, fills the fields from the common one',
		async (_, rows) => {
			const wrapper = mountPanel(rows, {
				defaults: { ...defaults(), address: { ...common, phone: '123' } },
			})
			expect(
				['Address line 1', 'City', 'Country'].map((name) =>
					fieldValue(wrapper, name)
				)
			).toEqual(['Andheri', 'Mumbai', 'India'])
			expect((input(wrapper, 'Phone').element as HTMLInputElement).value).toBe(
				'123'
			)
			expect(wrapper.text()).not.toContain('Andheri, Mumbai, India')
			await wrapper.setProps({ flagMissing: true })
			expect(named(wrapper, 'City').attributes('aria-invalid')).toBeUndefined()
			expect(has(wrapper, 'missing-details')).toBe(false)
		}
	)

	const differing = () => ({
		defaults: { ...defaults(), address: common },
		overrides: {
			'a@x.com': {
				...emptyOverride(),
				address: { ...common, city: 'Pune' },
			},
		},
	})

	it('notes different addresses instead of showing the fields', async () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], differing())
		expect(text(wrapper, 'address-differs')).toContain(
			'Different addresses for these 2 students'
		)
		expect(text(wrapper, 'address-overwrite')).toBe('Overwrite')
		expect(has(wrapper, 'address-fields')).toBe(false)
		expect(has(wrapper, 'address-use-existing')).toBe(false)
		expect(wrapper.find('[data-field="Phone"]').exists()).toBe(false)
		await wrapper.setProps({ flagMissing: true })
		expect(has(wrapper, 'missing-details')).toBe(false)
	})

	it.each([
		[
			'a linked address against a typed one',
			{ ...emptyOverride(), address: SAVED_ADDRESS },
		],
		[
			'only the phone',
			{ ...emptyOverride(), address: { ...common, phone: '9' } },
		],
	])('counts %s as different', (_, own) => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], {
			defaults: { ...defaults(), address: common },
			overrides: { 'a@x.com': own },
		})
		expect(has(wrapper, 'address-differs')).toBe(true)
	})

	it('Overwrite opens empty fields, focuses the first and writes to every ticked student', async () => {
		const wrapper = mount(EnrollPaymentPanel, {
			props: {
				rows: [row('a@x.com'), row('b@x.com')],
				total: 3,
				showBack: false,
				choices: {},
				...differing(),
				'onUpdate:overrides': (value: Record<string, PaymentOverride>) =>
					wrapper.setProps({ overrides: value }),
			},
			attachTo: document.body,
		})
		await press(wrapper, 'address-overwrite')
		await flushPromises()
		const fields = wrapper.get('[data-testid="address-fields"]')
		expect(document.activeElement).toBe(fields.find('input').element)
		expect(
			fields
				.findAll('input')
				.map((el) => (el.element as HTMLInputElement).value)
		).toEqual(['', '', '', '', '', ''])
		expect(has(wrapper, 'address-use-existing')).toBe(true)
		expect(wrapper.find('[data-field="Phone"]').exists()).toBe(true)

		await named(wrapper, 'City').setValue('Delhi')
		for (const member of ['a@x.com', 'b@x.com']) {
			expect(lastOverrides(wrapper)?.[member].address).toEqual({
				...emptyAddress(),
				city: 'Delhi',
			})
		}
		expect(fieldValue(wrapper, 'City')).toBe('Delhi')
		expect(has(wrapper, 'address-differs')).toBe(false)
	})

	it('Cancel puts back every ticked address, shows the note and refocuses Overwrite', async () => {
		const before = differing()
		const wrapper = mount(EnrollPaymentPanel, {
			props: {
				rows: [row('a@x.com'), row('b@x.com')],
				total: 3,
				showBack: false,
				choices: {},
				...before,
				'onUpdate:overrides': (value: Record<string, PaymentOverride>) =>
					wrapper.setProps({ overrides: value }),
			},
			attachTo: document.body,
		})
		expect(has(wrapper, 'address-cancel')).toBe(false)
		await press(wrapper, 'address-overwrite')
		await named(wrapper, 'City').setValue('Delhi')
		await named(wrapper, 'Address line 1').setValue('MG Road')
		expect(has(wrapper, 'address-differs')).toBe(false)
		await press(wrapper, 'address-use-existing')
		await press(wrapper, 'address-cancel')
		await flushPromises()

		expect(lastOverrides(wrapper)).toEqual(before.overrides)
		expect(has(wrapper, 'address-differs')).toBe(true)
		expect(has(wrapper, 'address-cancel')).toBe(false)
		expect(document.activeElement).toBe(
			wrapper.get('[data-testid="address-overwrite"]').element
		)
	})

	it('collapses back to the note when the ticked students change', async () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], differing())
		await press(wrapper, 'address-overwrite')
		expect(has(wrapper, 'address-fields')).toBe(true)
		await wrapper.setProps({
			rows: [row('a@x.com'), row('b@x.com'), row('c@x.com')],
		})
		expect(text(wrapper, 'address-differs')).toContain(
			'Different addresses for these 3 students'
		)
	})

	it('shows a shared linked address as its summary, not as fields', () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], {
			defaults: { ...defaults(), address: SAVED_ADDRESS },
		})
		expect(text(wrapper, 'saved-address')).toContain('Pune')
		expect(has(wrapper, 'address-fields')).toBe(false)
	})

	it('editing a field starts from the common address for the ticked students', async () => {
		const wrapper = mountPanel([row('a@x.com'), row('b@x.com')], {
			defaults: { ...defaults(), address: common },
		})
		await named(wrapper, 'City').setValue('London')
		for (const member of ['a@x.com', 'b@x.com']) {
			expect(lastOverrides(wrapper)?.[member].address).toEqual({
				...common,
				city: 'London',
			})
		}
		expect(
			['Address line 1', 'City', 'Country'].map((name) =>
				fieldValue(wrapper, name)
			)
		).toEqual(['Andheri', 'London', 'India'])
		expect(has(wrapper, 'missing-details')).toBe(false)
	})

	const picker = (wrapper: Wrapper) =>
		wrapper.get('[data-testid="link-Address"]')

	it('Use existing address searches the student addresses and links the picked one', async () => {
		callMock.mockResolvedValue({
			address_line1: '1 Main St',
			address_line2: null,
			city: 'Pune',
			country: 'India',
		})
		const wrapper = mountPanel([row('a@x.com', 'ready', { full_name: 'Jane' })])
		await press(wrapper, 'address-use-existing')
		expect(picker(wrapper).attributes('data-query')).toBe(
			'frappe.contacts.doctype.address.address.address_query'
		)
		expect(JSON.parse(picker(wrapper).attributes('data-filters')!)).toEqual({
			link_doctype: 'User',
			link_name: 'a@x.com',
		})
		await picker(wrapper).setValue('ADDR-1')
		await flushPromises()
		expect(callMock).toHaveBeenLastCalledWith('frappe.client.get_value', {
			doctype: 'Address',
			filters: 'ADDR-1',
			fieldname: expect.arrayContaining(['address_line1', 'city']),
		})
		expect(lastOverrides(wrapper)?.['a@x.com'].address).toEqual({
			name: 'ADDR-1',
			summary: '1 Main St, Pune, India',
		})
		expect(text(wrapper, 'saved-address')).toContain('1 Main St, Pune, India')
		expect(wrapper.find('[data-testid="link-Address"]').exists()).toBe(false)
		expect(wrapper.find('input[aria-label="City"]').exists()).toBe(false)
		expect(wrapper.find('[data-field="Phone"]').exists()).toBe(false)
		await press(wrapper, 'address-change')
		expect(picker(wrapper).exists()).toBe(true)
		await press(wrapper, 'address-add-new')
		expect(lastOverrides(wrapper)?.['a@x.com'].address).toEqual(emptyAddress())
		expect(has(wrapper, 'address-fields')).toBe(true)
	})

	it('the details for all search Billing addresses and keep the name if the lookup fails', async () => {
		callMock.mockRejectedValue(new Error('nope'))
		const wrapper = mountPanel([])
		await press(wrapper, 'address-use-existing')
		expect(JSON.parse(picker(wrapper).attributes('data-filters')!)).toEqual({
			address_type: 'Billing',
		})
		await picker(wrapper).setValue('ADDR-9')
		await flushPromises()
		const events = wrapper.emitted('update:defaults') as PaymentDefaults[][]
		expect(events.at(-1)?.[0].address).toEqual({ name: 'ADDR-9', summary: '' })
		expect(text(wrapper, 'saved-address')).toContain('ADDR-9')
	})

	it('goes back from the existing-address picker to a new address', async () => {
		const wrapper = mountPanel([])
		await press(wrapper, 'address-use-existing')
		expect(picker(wrapper).exists()).toBe(true)
		expect(has(wrapper, 'address-fields')).toBe(false)
		await press(wrapper, 'address-add-new')
		const events = wrapper.emitted('update:defaults') as PaymentDefaults[][]
		expect(events.at(-1)?.[0].address).toBeNull()
		expect(wrapper.find('[data-testid="link-Address"]').exists()).toBe(false)
		expect(has(wrapper, 'address-fields')).toBe(true)
	})

	it('lists what the details for all still need', async () => {
		const wrapper = mountPanel([], {
			defaults: { ...defaults(), amount: null },
		})
		expect(text(wrapper, 'missing-details')).toBe(
			'Missing: Amount, Billing address'
		)
		await input(wrapper, 'Amount').setValue('5')
		expect(text(wrapper, 'missing-details')).toBe('Missing: Billing address')
		await named(wrapper, 'Address line 1').setValue('1 Main St')
		await named(wrapper, 'City').setValue('Pune')
		await named(wrapper, 'Country').setValue('India')
		expect(wrapper.find('[data-testid="missing-details"]').exists()).toBe(false)
	})
})
