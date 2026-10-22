import { afterEach, describe, expect, it, vi } from 'vitest'
import { config, enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

config.global.mocks = { __: translate }

vi.mock('frappe-ui', () => ({
	Switch: {
		name: 'SwitchStub',
		props: ['modelValue', 'label', 'description'],
		emits: ['update:modelValue'],
		template: `<div data-testid="switch"><label>{{ label }}</label><span>{{ description }}</span><button type="button" data-testid="switch-toggle" @click="$emit('update:modelValue', !modelValue)" /></div>`,
	},
	Badge: {
		props: ['label', 'theme'],
		template: `<span data-testid="badge" :data-theme="theme">{{ label }}</span>`,
	},
	Button: {
		inheritAttrs: false,
		props: ['icon'],
		template: `<button v-bind="$attrs"><span v-if="icon" :class="icon" /><slot /></button>`,
	},
	Avatar: {
		props: ['image', 'label'],
		template: `<span data-testid="avatar" />`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', Number($event.target.value))" /></label>`,
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
	LoadingText: {
		template: `<div data-testid="loading">Loading</div>`,
	},
}))

vi.mock('@/components/Controls/Link.vue', () => ({
	default: defineComponent({
		props: ['doctype', 'modelValue', 'label', 'required'],
		render() {
			return h('div', { 'data-testid': `link-${this.doctype}` })
		},
	}),
}))

vi.mock('@/components/Enrollment/StudentPicker.vue', () => ({
	default: defineComponent({
		props: ['modelValue', 'enrollDoctype', 'enrollDocname', 'includeEnrolled'],
		render() {
			return h('div', {
				'data-testid': 'picker',
				'data-include-enrolled': String(this.includeEnrolled),
			})
		},
	}),
}))

import EnrollSelectStep from '@/components/Enrollment/EnrollSelectStep.vue'
import EnrollReviewStep from '@/components/Enrollment/EnrollReviewStep.vue'
import EnrollPaymentStep from '@/components/Enrollment/EnrollPaymentStep.vue'
import EnrollSummary from '@/components/Enrollment/EnrollSummary.vue'
import type {
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
	PaymentChoice,
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

	it('shows the certificate switch with its price hint', async () => {
		const wrapper = mount(EnrollSelectStep, {
			props: {
				target: target({ paidKind: 'certificate', priceLabel: '₹999' }),
				members: [],
				paid: false,
				'onUpdate:paid': (value: boolean) => wrapper.setProps({ paid: value }),
			},
		})
		const text = wrapper.text()
		expect(text).toContain('Students have purchased the certificate')
		expect(text).toContain('Certificate price ₹999')
		expect(
			wrapper.get('[data-testid="picker"]').attributes('data-include-enrolled')
		).toBe('false')
		await wrapper.get('[data-testid="switch-toggle"]').trigger('click')
		expect(
			wrapper.get('[data-testid="picker"]').attributes('data-include-enrolled')
		).toBe('true')
	})

	it('gives no price hint when there is no price to show', () => {
		const wrapper = mount(EnrollSelectStep, {
			props: {
				target: target({ paidKind: 'batch', priceLabel: null }),
				members: [],
				paid: false,
			},
		})
		expect(wrapper.text()).toContain('Students have paid for this batch')
		expect(
			wrapper.findComponent({ name: 'SwitchStub' }).props('description')
		).toBeUndefined()
	})
})

describe('EnrollReviewStep', () => {
	it('lists one row per student with name, email and status text', () => {
		const statuses: EnrollStatus[] = [
			'ready',
			'enrolled',
			'no_user',
			'disabled',
			'upgrade',
			'certificate_purchased',
		]
		const rows = statuses.map((status, i) =>
			row(`s${i}@x.com`, status, { full_name: `Student ${i}` })
		)
		const wrapper = mount(EnrollReviewStep, {
			props: { rows, seatsLeft: null, loading: false },
		})
		expect(wrapper.findAll('li')).toHaveLength(6)
		const text = wrapper.text()
		expect(text).toContain('Student 0')
		expect(text).toContain('s0@x.com')
		for (const label of [
			'Ready',
			'Already enrolled (will be skipped)',
			'No user with this email (will be skipped)',
			'User is disabled (will be skipped)',
			'Enrolled, will get certificate',
			'Certificate already purchased (will be skipped)',
		]) {
			expect(text).toContain(label)
		}
	})

	it('removes a row with a trash button named for the student', async () => {
		const wrapper = mount(EnrollReviewStep, {
			props: {
				rows: [row('jane@x.com', 'ready', { full_name: 'Jane Doe' })],
				seatsLeft: null,
				loading: false,
			},
		})
		const button = wrapper.get('[aria-label="Remove Jane Doe"]')
		expect(button.find('.lucide-trash-2').exists()).toBe(true)
		await button.trigger('click')
		expect(wrapper.emitted('remove')).toEqual([['jane@x.com']])
	})

	it('warns when ready students exceed the seats left', () => {
		const four = ['a', 'b', 'c', 'd'].map((n) => row(`${n}@x.com`))
		const over = mount(EnrollReviewStep, {
			props: { rows: four, seatsLeft: 3, loading: false },
		})
		expect(over.text()).toContain('3 seats left, 4 selected')
		const fits = mount(EnrollReviewStep, {
			props: { rows: four.slice(0, 3), seatsLeft: 3, loading: false },
		})
		expect(fits.find('[data-testid="error"]').exists()).toBe(false)
	})

	it('clamps negative seats to zero in the message', () => {
		const wrapper = mount(EnrollReviewStep, {
			props: { rows: [row('a@x.com')], seatsLeft: -2, loading: false },
		})
		expect(wrapper.text()).toContain('0 seats left, 1 selected')
	})

	it('shows loading text instead of rows while loading', () => {
		const wrapper = mount(EnrollReviewStep, {
			props: { rows: [], seatsLeft: null, loading: true },
		})
		expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
		expect(wrapper.find('ul').exists()).toBe(false)
	})
})

describe('EnrollPaymentStep', () => {
	const defaults = { amount: 999, currency: 'INR', source: null }

	it('prefills defaults and offers Link existing only when there is a payment to link', () => {
		const wrapper = mount(EnrollPaymentStep, {
			props: {
				rows: [
					row('a@x.com', 'ready', {
						linkable_payments: [
							{
								name: 'P1',
								amount: 999,
								currency: 'INR',
								creation: '2026-01-02 10:00:00',
							},
						],
					}),
					row('b@x.com'),
				],
				defaults,
				choices: {},
			},
		})
		expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
			'999'
		)
		expect(wrapper.find('[data-testid="link-Currency"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="link-LMS Source"]').exists()).toBe(true)
		expect(wrapper.findAll('[data-testid="tabs"]')).toHaveLength(1)
		expect(wrapper.text()).toContain('New payment')
	})

	it('requires a payment pick for a Link existing row', async () => {
		const wrapper = mount(EnrollPaymentStep, {
			props: {
				rows: [
					row('a@x.com', 'ready', {
						linkable_payments: [
							{
								name: 'P1',
								amount: 999,
								currency: 'INR',
								creation: '2026-01-02 10:00:00',
							},
						],
					}),
				],
				defaults,
				choices: {},
			},
		})
		await wrapper.get('[data-value="link"]').trigger('click')
		const events = wrapper.emitted('update:choices') as Record<
			string,
			PaymentChoice
		>[][]
		expect(events.at(-1)?.[0]['a@x.com']).toEqual({
			mode: 'link',
			payment: null,
		})
	})

	it('names each payment-mode toggle for its student', () => {
		const wrapper = mount(EnrollPaymentStep, {
			props: {
				rows: [
					row('a@x.com', 'ready', {
						full_name: 'Jane Doe',
						linkable_payments: [
							{
								name: 'P1',
								amount: 999,
								currency: 'INR',
								creation: '2026-01-02 10:00:00',
							},
						],
					}),
				],
				defaults,
				choices: {},
			},
		})
		const group = wrapper.get(
			'[role="group"][aria-label="Payment mode for Jane Doe"]'
		)
		expect(group.find('[data-testid="tabs"]').exists()).toBe(true)
	})
})

describe('EnrollSummary', () => {
	it('summarises enrolled, upgraded and skipped with each reason', () => {
		const wrapper = mount(EnrollSummary, {
			props: {
				result: {
					added: ['a@x.com'],
					upgraded: ['b@x.com'],
					errors: [{ member: 'c@x.com', error: 'Seat limit reached' }],
				},
				skipped: [{ member: 'd@x.com', error: 'Already enrolled' }],
			},
		})
		const text = wrapper.text()
		expect(text).toContain('1 enrolled, 1 upgraded to certificate, 2 skipped')
		expect(text).toContain('c@x.com: Seat limit reached')
		expect(text).toContain('d@x.com: Already enrolled')
	})
})
