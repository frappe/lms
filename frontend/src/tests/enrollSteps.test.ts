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

vi.mock('frappe-ui', () => ({
	Switch: {
		name: 'SwitchStub',
		props: ['modelValue', 'label', 'description'],
		emits: ['update:modelValue'],
		template: `<div data-testid="switch"><label>{{ label }}</label><span>{{ description }}</span><button type="button" data-testid="switch-toggle" @click="$emit('update:modelValue', !modelValue)" /></div>`,
	},
	Badge: {
		props: ['label', 'theme', 'variant'],
		template: `<span data-testid="badge" :data-theme="theme" :data-variant="variant">{{ label }}</span>`,
	},
	Button: {
		inheritAttrs: false,
		props: ['icon', 'label'],
		emits: ['click'],
		template: `<button v-bind="$attrs" @click="$emit('click')"><span v-if="icon" :class="icon" />{{ label }}<slot name="icon" /><slot /></button>`,
	},
	Avatar: {
		props: ['image', 'label'],
		template: `<span data-testid="avatar" />`,
	},
	FormControl: {
		inheritAttrs: false,
		props: ['modelValue', 'label', 'type', 'placeholder', 'required'],
		emits: ['update:modelValue'],
		template: `<label :data-field="label" :data-required="String(!!required)">{{ label }}<input :value="modelValue" :placeholder="placeholder" :aria-describedby="$attrs['aria-describedby']" @input="$emit('update:modelValue', type === 'number' ? ($event.target.value === '' ? '' : Number($event.target.value)) : $event.target.value)" /></label>`,
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
		props: ['doctype', 'modelValue', 'label', 'required', 'placeholder'],
		emits: ['update:modelValue'],
		render() {
			return h('input', {
				'data-testid': `link-${this.doctype}`,
				'data-field': this.label,
				'data-required': String(!!this.required),
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

vi.mock('@/components/ResponsiveListView.vue', async () => {
	const { reactive } = await import('vue')
	return {
		default: defineComponent({
			name: 'ResponsiveListViewStub',
			props: ['columns', 'rows', 'rowKey', 'options'],
			setup() {
				const selections = reactive(new Set<string>())
				return { selections }
			},
			template: `<div data-testid="list">
				<div data-testid="columns">{{ columns.map((c) => c.label).join('|') }}</div>
				<div v-for="row in rows" :key="row[rowKey]" data-testid="row" :data-key="row[rowKey]" @click="options?.onRowClick?.(row)">
					<span v-for="column in columns" :key="column.key" :data-col="column.key"><slot name="cell" :column="column" :row="row" :value="row[column.key]">{{ row[column.key] }}</slot></span>
				</div>
				<div v-if="selections.size" data-testid="banner"><slot name="selection-actions" :selections="selections" :unselectAll="() => selections.clear()" /></div>
			</div>`,
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
					h('ul', { 'data-testid': 'picker-list' }),
				]
			)
		},
	}),
}))

import EnrollSelectStep from '@/components/Enrollment/EnrollSelectStep.vue'
import EnrollReviewStep from '@/components/Enrollment/EnrollReviewStep.vue'
import EnrollPaymentStep from '@/components/Enrollment/EnrollPaymentStep.vue'
import EnrollSummary from '@/components/Enrollment/EnrollSummary.vue'
import { emptyAddress, emptyOverride } from '@/components/Enrollment/enrollment'
import type {
	EnrollPreviewRow,
	EnrollStatus,
	EnrollTarget,
	PaymentChoice,
	PaymentDefaults,
	PaymentOverride,
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
		const toggle = wrapper.findComponent({ name: 'SwitchStub' })
		expect(toggle.props('label')).toBe('Record payments')
		expect(toggle.props('description')).toBe(
			'Turn off to enroll without a payment record.'
		)
	})
})

const reviewProps = (
	rows: EnrollPreviewRow[],
	extra: Record<string, unknown> = {}
) => ({
	rows,
	seatsLeft: null,
	loading: false,
	paid: false,
	certificate: false,
	paymentLabels: {},
	...extra,
})

describe('EnrollReviewStep', () => {
	it('lists one row per student with name and email, and no Status column', () => {
		const rows = ['a', 'b'].map((n, i) =>
			row(`${n}@x.com`, 'ready', { full_name: `Student ${i}` })
		)
		const wrapper = mount(EnrollReviewStep, { props: reviewProps(rows) })
		expect(wrapper.findAll('[data-testid="row"]')).toHaveLength(2)
		expect(wrapper.get('[data-testid="columns"]').text()).toBe('Student|Email')
		expect(wrapper.text()).toContain('Student 0')
		expect(wrapper.text()).toContain('a@x.com')
		expect(wrapper.find('[data-testid="badge"]').exists()).toBe(false)
		expect(wrapper.find('[data-col="status"]').exists()).toBe(false)
	})

	it('marks each row New or Upgrade in certificate mode', () => {
		const rows = [row('a@x.com', 'ready'), row('b@x.com', 'upgrade')]
		const wrapper = mount(EnrollReviewStep, {
			props: reviewProps(rows, { certificate: true }),
		})
		const cells = wrapper
			.findAll('[data-testid="row"]')
			.map((el) => el.find('[data-testid="badge"]'))
		expect(cells.map((badge) => badge.text())).toEqual(['New', 'Upgrade'])
		for (const badge of cells) {
			expect(badge.attributes('data-variant')).toBe('outline')
		}
	})

	it('adds a Payment column while payments are on', () => {
		const wrapper = mount(EnrollReviewStep, {
			props: reviewProps([row('a@x.com')], {
				paid: true,
				paymentLabels: { 'a@x.com': 'New · ₹100 · Website' },
			}),
		})
		expect(wrapper.get('[data-testid="columns"]').text()).toBe(
			'Student|Email|Payment'
		)
		expect(wrapper.get('[data-col="payment"]').text()).toBe(
			'New · ₹100 · Website'
		)
	})

	it('removes the selected rows from the selection banner', async () => {
		const wrapper = mount(EnrollReviewStep, {
			props: reviewProps([row('a@x.com'), row('b@x.com'), row('c@x.com')]),
		})
		const list = wrapper.findComponent({ name: 'ResponsiveListViewStub' })
		expect(list.props('options')).toMatchObject({ selectable: true })
		const selections = (list.vm as unknown as { selections: Set<string> })
			.selections
		selections.add('a@x.com')
		selections.add('c@x.com')
		await flushPromises()
		const remove = wrapper.get('[data-testid="banner"] button')
		expect(remove.text()).toBe('Remove')
		expect(remove.find('.lucide-trash-2').exists()).toBe(true)
		await remove.trigger('click')
		expect(wrapper.emitted('remove')).toEqual([[['a@x.com', 'c@x.com']]])
		expect(selections.size).toBe(0)
	})

	it('warns when ready students exceed the seats left', () => {
		const four = ['a', 'b', 'c', 'd'].map((n) => row(`${n}@x.com`))
		const over = mount(EnrollReviewStep, {
			props: reviewProps(four, { seatsLeft: 3 }),
		})
		expect(over.text()).toContain('3 seats left, 4 selected')
		const fits = mount(EnrollReviewStep, {
			props: reviewProps(four.slice(0, 3), { seatsLeft: 3 }),
		})
		expect(fits.find('[data-testid="error"]').exists()).toBe(false)
	})

	it('clamps negative seats to zero in the message', () => {
		const wrapper = mount(EnrollReviewStep, {
			props: reviewProps([row('a@x.com')], { seatsLeft: -2 }),
		})
		expect(wrapper.text()).toContain('0 seats left, 1 selected')
	})

	it('shows loading text instead of rows while loading', () => {
		const wrapper = mount(EnrollReviewStep, {
			props: reviewProps([], { loading: true }),
		})
		expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="list"]').exists()).toBe(false)
	})
})

describe('EnrollPaymentStep', () => {
	const defaults = (): PaymentDefaults => ({
		amount: 999,
		currency: 'INR',
		source: null,
		address: emptyAddress(),
	})
	const linkable = [
		{
			name: 'P1',
			amount: 999,
			currency: 'INR',
			creation: '2026-01-02 10:00:00',
		},
	]

	const mountPayments = (
		rows: EnrollPreviewRow[],
		models: Partial<{
			defaults: PaymentDefaults
			choices: Record<string, PaymentChoice>
			overrides: Record<string, PaymentOverride>
		}> = {}
	) => {
		const wrapper = mount(EnrollPaymentStep, {
			props: {
				rows,
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

	type Wrapper = ReturnType<typeof mountPayments>

	const panel = (wrapper: Wrapper) =>
		wrapper.get('[data-testid="payment-panel"]')
	const field = (wrapper: Wrapper, label: string) =>
		panel(wrapper).get(`[data-field="${label}"]`)
	const input = (wrapper: Wrapper, label: string) => {
		const el = field(wrapper, label)
		return el.element.tagName === 'INPUT' ? el : el.get('input')
	}
	const openRow = async (wrapper: Wrapper, member: string) => {
		await wrapper
			.get(`[data-testid="row"][data-key="${member}"]`)
			.trigger('click')
		await flushPromises()
	}

	beforeEach(() => {
		screen.mobile = false
	})

	it('lists students with payment columns beside a Common details panel', () => {
		const wrapper = mountPayments([
			row('a@x.com', 'ready', { full_name: 'Jane Doe' }),
		])
		expect(wrapper.get('[data-testid="columns"]').text()).toBe(
			'Student|Payment|Billing address'
		)
		const list = wrapper.findComponent({ name: 'ResponsiveListViewStub' })
		expect(list.props('options')).toMatchObject({
			enableActive: true,
			selectable: false,
		})
		expect(wrapper.get('[data-col="payment"]').text()).toMatch(/999/)
		expect(wrapper.get('[data-col="address"]').text()).toBe('—')
		expect(panel(wrapper).text()).toContain('Common details')
		expect((input(wrapper, 'Amount').element as HTMLInputElement).value).toBe(
			'999'
		)
		expect(field(wrapper, 'Source').attributes('data-required')).toBe('false')
		expect(
			wrapper.get('[data-testid="payment-panel"]').classes()
		).not.toContain('border-s')
	})

	it('edits the common amount and source', async () => {
		const wrapper = mountPayments([row('a@x.com')])
		await input(wrapper, 'Amount').setValue('50')
		await input(wrapper, 'Source').setValue('Web')
		const events = wrapper.emitted('update:defaults') as PaymentDefaults[][]
		expect(events.at(-1)?.[0]).toMatchObject({ amount: 50, source: 'Web' })
	})

	it('requires address line 1, city and country once any address field is filled', async () => {
		const wrapper = mountPayments([row('a@x.com')])
		expect(field(wrapper, 'City').attributes('data-required')).toBe('false')
		await input(wrapper, 'Phone').setValue('99')
		for (const label of ['Address line 1', 'City', 'Country']) {
			expect(field(wrapper, label).attributes('data-required')).toBe('true')
		}
		expect(field(wrapper, 'State').attributes('data-required')).toBe('false')
	})

	it('opens a student, shows common values as placeholders, and clearing a field returns to the common value', async () => {
		const wrapper = mountPayments(
			[row('a@x.com', 'ready', { full_name: 'Jane Doe' })],
			{ defaults: { ...defaults(), source: 'Web' } }
		)
		expect(wrapper.find('[data-testid="custom-badge"]').exists()).toBe(false)
		await openRow(wrapper, 'a@x.com')
		expect(panel(wrapper).text()).toContain('Jane Doe')
		expect(
			(input(wrapper, 'Billing name').element as HTMLInputElement).placeholder
		).toBe('Jane Doe')
		expect(
			(input(wrapper, 'Source').element as HTMLInputElement).placeholder
		).toBe('Web')

		await input(wrapper, 'Amount').setValue('10')
		const overrides = () =>
			(
				wrapper.emitted('update:overrides') as Record<
					string,
					PaymentOverride
				>[][]
			).at(-1)?.[0]['a@x.com']
		expect(overrides()?.amount).toBe(10)
		expect(wrapper.get('[data-testid="custom-badge"]').text()).toBe('Custom')

		await input(wrapper, 'Amount').setValue('')
		expect(overrides()?.amount).toBeNull()
		expect(wrapper.find('[data-testid="custom-badge"]').exists()).toBe(false)
	})

	it('has no Use common value buttons', async () => {
		const wrapper = mountPayments([row('a@x.com')])
		await openRow(wrapper, 'a@x.com')
		await input(wrapper, 'Amount').setValue('10')
		await input(wrapper, 'Source').setValue('Web')
		expect(panel(wrapper).text()).not.toContain('Use common value')
		expect(
			panel(wrapper).find('[aria-label^="Use common value"]').exists()
		).toBe(false)
	})

	it('draws Common details as an outline button and no divider before the panel', async () => {
		const wrapper = mountPayments([row('a@x.com')])
		await openRow(wrapper, 'a@x.com')
		expect(
			panel(wrapper)
				.get('[data-testid="common-details-link"]')
				.attributes('variant')
		).toBe('outline')
		expect(panel(wrapper).classes().join(' ')).not.toMatch(/border/)
	})

	it('gives Payment at least the width of Billing address', () => {
		const wrapper = mountPayments([row('a@x.com')])
		const list = wrapper.findComponent({ name: 'ResponsiveListViewStub' })
		const columns = list.props('columns') as { key: string; width: number }[]
		const width = (key: string) => columns.find((c) => c.key === key)!.width
		expect(width('payment')).toBeGreaterThanOrEqual(width('address'))
	})

	it('shows the effective student values in the list', () => {
		const wrapper = mountPayments([row('a@x.com')], {
			defaults: { ...defaults(), source: 'Web' },
			overrides: {
				'a@x.com': {
					...emptyOverride(),
					source: 'Referral',
					address: {
						...emptyAddress(),
						address_line1: '1 Main St',
						city: 'Pune',
						country: 'India',
					},
				},
			},
		})
		expect(wrapper.get('[data-col="payment"]').text()).toMatch(
			/999.* · Referral$/
		)
		expect(wrapper.get('[data-col="address"]').text()).toBe(
			'1 Main St, Pune, India'
		)
	})

	it('goes back to Common details from the panel header', async () => {
		const wrapper = mountPayments([
			row('a@x.com', 'ready', { full_name: 'Jane Doe' }),
		])
		await openRow(wrapper, 'a@x.com')
		await panel(wrapper)
			.get('[data-testid="common-details-link"]')
			.trigger('click')
		await flushPromises()
		expect(panel(wrapper).find('[data-field="Billing name"]').exists()).toBe(
			false
		)
		expect(panel(wrapper).text()).toContain('Common details')
	})

	it('offers Link existing only for a student with a payment to link, and names the toggle', async () => {
		const wrapper = mountPayments([
			row('a@x.com', 'ready', {
				full_name: 'Jane Doe',
				linkable_payments: linkable,
			}),
			row('b@x.com'),
		])
		await openRow(wrapper, 'b@x.com')
		expect(
			panel(wrapper).find('[aria-label="Payment mode for b@x.com"]').exists()
		).toBe(false)
		await openRow(wrapper, 'a@x.com')
		const group = panel(wrapper).get(
			'[role="group"][aria-label="Payment mode for Jane Doe"]'
		)
		await group.get('[data-value="link"]').trigger('click')
		const events = wrapper.emitted('update:choices') as Record<
			string,
			PaymentChoice
		>[][]
		expect(events.at(-1)?.[0]['a@x.com']).toEqual({
			mode: 'link',
			payment: null,
		})
		expect(panel(wrapper).find('[data-field="Amount"]').exists()).toBe(false)
		await panel(wrapper).get('[data-testid="payment-select"]').setValue('P1')
		expect(
			wrapper.get('[data-key="a@x.com"] [data-col="payment"]').text()
		).toBe('Linked · P1')
	})

	const addressGroup = (wrapper: Wrapper, name: string) =>
		panel(wrapper).get(
			`[role="group"][aria-label="Billing address for ${name}"]`
		)

	it('a student uses the common address by default and shows it read-only', async () => {
		const common = {
			...emptyAddress(),
			address_line1: 'Andheri',
			city: 'Mumbai',
			country: 'India',
		}
		const wrapper = mountPayments(
			[row('a@x.com', 'ready', { full_name: 'Jane Doe' }), row('b@x.com')],
			{ defaults: { ...defaults(), source: 'Web', address: common } }
		)
		await openRow(wrapper, 'a@x.com')
		expect(addressGroup(wrapper, 'Jane Doe').text()).toContain(
			'Same as common address'
		)
		expect(
			panel(wrapper).get('[data-testid="common-address-summary"]').text()
		).toBe('Andheri, Mumbai, India')
		expect(panel(wrapper).find('[data-field="City"]').exists()).toBe(false)

		const bare = mountPayments([row('b@x.com')], {
			defaults: { ...defaults(), source: 'Web' },
		})
		await openRow(bare, 'b@x.com')
		expect(
			panel(bare).get('[data-testid="common-address-summary"]').text()
		).toBe('No address')
	})

	it('a different address starts empty, needs its own fields and replaces the common one', async () => {
		const common = {
			...emptyAddress(),
			address_line1: 'Andheri',
			city: 'Mumbai',
			country: 'India',
			pincode: '400053',
		}
		const wrapper = mountPayments(
			[row('a@x.com', 'ready', { full_name: 'Jane Doe' })],
			{ defaults: { ...defaults(), source: 'Web', address: common } }
		)
		await openRow(wrapper, 'a@x.com')
		await addressGroup(wrapper, 'Jane Doe')
			.get('[data-value="own"]')
			.trigger('click')
		const overrides = () =>
			(
				wrapper.emitted('update:overrides') as Record<
					string,
					PaymentOverride
				>[][]
			).at(-1)?.[0]['a@x.com']
		expect(overrides()?.address).toEqual(emptyAddress())
		for (const label of ['Address line 1', 'City', 'Country']) {
			expect(field(wrapper, label).attributes('data-required')).toBe('true')
		}
		const pincode = input(wrapper, 'Postal code').element as HTMLInputElement
		expect([pincode.value, pincode.placeholder]).toEqual(['', ''])
		const error = panel(wrapper).get(
			'[data-testid="error"]:not([data-testid="missing-details"])'
		)
		expect(error.text()).toBe(
			'An address needs address line 1, city and country.'
		)
		await input(wrapper, 'City').setValue('London')
		expect(overrides()?.address).toEqual({ ...emptyAddress(), city: 'London' })
		expect(wrapper.find('[data-testid="incomplete-badge"]').exists()).toBe(true)

		await addressGroup(wrapper, 'Jane Doe')
			.get('[data-value="common"]')
			.trigger('click')
		expect(overrides()?.address).toBeNull()
	})

	it('ties the address error to the address inputs', async () => {
		const wrapper = mountPayments([row('a@x.com')])
		await input(wrapper, 'Phone').setValue('99')
		const error = panel(wrapper)
			.findAll('[data-testid="error"]')
			.find((el) => el.text().startsWith('An address needs'))
		const id = error?.attributes('id')
		expect(id).toBeTruthy()
		expect(input(wrapper, 'Phone').attributes('aria-describedby')).toBe(id)
		const group = panel(wrapper).get(`[role="group"][aria-describedby="${id}"]`)
		expect(group.find('[data-field="City"]').exists()).toBe(true)
	})

	it('marks a row Incomplete and lists what it still needs', async () => {
		const wrapper = mountPayments(
			[row('a@x.com', 'ready', { full_name: 'Jane Doe' })],
			{ defaults: { ...defaults(), amount: null } }
		)
		const badge = wrapper.get('[data-testid="incomplete-badge"]')
		expect(badge.text()).toBe('Incomplete')
		expect(badge.get('[data-testid="badge"]').attributes('data-variant')).toBe(
			'outline'
		)
		expect(badge.get('[data-testid="badge"]').attributes('data-theme')).toBe(
			'red'
		)
		await openRow(wrapper, 'a@x.com')
		expect(panel(wrapper).get('[data-testid="missing-details"]').text()).toBe(
			'Missing: Amount'
		)
		await input(wrapper, 'Amount').setValue('5')
		expect(wrapper.find('[data-testid="incomplete-badge"]').exists()).toBe(
			false
		)
		expect(
			panel(wrapper).find('[data-testid="missing-details"]').exists()
		).toBe(false)
	})

	it('marks the open row as selected and announces the panel title', async () => {
		const wrapper = mountPayments([
			row('a@x.com', 'ready', { full_name: 'Jane Doe' }),
			row('b@x.com'),
		])
		const announcer = wrapper.get('[data-testid="panel-announcer"]')
		expect(announcer.attributes('aria-live')).toBe('polite')
		expect(announcer.text()).toBe('Common details')
		await openRow(wrapper, 'a@x.com')
		expect(announcer.text()).toBe('Jane Doe')
		expect(
			wrapper.get('[data-key="a@x.com"] [data-col="student"]').text()
		).toContain('Selected')
		expect(
			wrapper.get('[data-key="b@x.com"] [data-col="student"]').text()
		).not.toContain('Selected')
	})

	it('on mobile, shows the panel as its own view with Back', async () => {
		screen.mobile = true
		const wrapper = mountPayments([
			row('a@x.com', 'ready', { full_name: 'Jane Doe' }),
		])
		expect(wrapper.find('[data-testid="payment-panel"]').exists()).toBe(false)
		await openRow(wrapper, 'a@x.com')
		expect(wrapper.find('[data-testid="list"]').exists()).toBe(false)
		expect(panel(wrapper).text()).toContain('Jane Doe')
		expect(wrapper.emitted('update:panelOpen')?.at(-1)).toEqual([true])
		await wrapper.get('[data-testid="payment-panel-back"]').trigger('click')
		expect(wrapper.find('[data-testid="list"]').exists()).toBe(true)
		await wrapper.get('[data-testid="common-details-open"]').trigger('click')
		expect(panel(wrapper).text()).toContain('Common details')
		expect(panel(wrapper).find('[data-field="Billing name"]').exists()).toBe(
			false
		)
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
