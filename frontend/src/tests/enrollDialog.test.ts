import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { formatMoney } from '@/components/Enrollment/enrollment'
import type { EnrollStatus, EnrollTarget, LinkablePayment } from '@/types'

const translate = (text: string, args?: unknown[]) =>
	args ? text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : text
vi.stubGlobal('__', translate)
enableAutoUnmount(afterEach)

const { api, callMock, field, toastMock } = vi.hoisted(() => ({
	field: `<label :data-field="label || $attrs['aria-label']" :data-value="modelValue ?? ''" :data-placeholder="placeholder" :data-error="error" :data-required="String(!!required)"><input :aria-label="$attrs['aria-label'] || label" :value="modelValue" :aria-invalid="error ? 'true' : undefined" @input="emitValue($event.target.value)" /></label>`,
	api: {} as Record<string, (params: Record<string, unknown>) => unknown>,
	callMock: vi.fn(),
	toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', async () => {
	const { reactive: live } = await import('vue')
	return {
		call: callMock,
		toast: toastMock,
		createResource: (options: { url: string }) => {
			const resource = live({
				loading: false,
				submit: async (
					params: Record<string, unknown>,
					handlers?: {
						onSuccess?: (data: unknown) => void
						onError?: (error: unknown) => void
					}
				) => {
					resource.loading = true
					try {
						const data = await api[options.url](params)
						handlers?.onSuccess?.(data)
						return data
					} catch (error) {
						handlers?.onError?.(error)
						throw error
					} finally {
						resource.loading = false
					}
				},
			})
			return resource
		},
		Avatar: { props: ['image', 'label'], template: `<span />` },
		Badge: {
			props: ['label', 'theme'],
			template: `<span data-badge :data-theme="theme">{{ label }}</span>`,
		},
		Button: {
			inheritAttrs: false,
			props: ['icon', 'label', 'variant'],
			emits: ['click'],
			template: `<button type="button" v-bind="$attrs" :aria-label="$attrs['aria-label'] || label" @click="$emit('click')">{{ label }}</button>`,
		},
		Checkbox: {
			props: ['modelValue', 'disabled'],
			template: `<input type="checkbox" :checked="modelValue" :disabled="disabled" />`,
		},
		ErrorMessage: {
			props: ['message'],
			template: `<div v-if="message" role="alert">{{ message }}</div>`,
		},
		FormControl: {
			inheritAttrs: false,
			props: [
				'modelValue',
				'label',
				'type',
				'placeholder',
				'required',
				'error',
			],
			emits: ['update:modelValue'],
			methods: {
				emitValue(this: { type: string; $emit: Function }, raw: string) {
					const number = this.type === 'number' && raw !== ''
					this.$emit('update:modelValue', number ? Number(raw) : raw)
				},
			},
			template: field,
		},
		MultiSelect: {
			inheritAttrs: false,
			props: ['modelValue', 'query', 'options', 'error', 'id'],
			emits: ['update:modelValue', 'update:query', 'update:open'],
			methods: {
				focus() {},
				toggle(this: { modelValue: string[]; $emit: Function }, value: string) {
					const has = this.modelValue.includes(value)
					this.$emit(
						'update:modelValue',
						has
							? this.modelValue.filter((item) => item !== value)
							: [...this.modelValue, value]
					)
				},
			},
			template: `<div data-testid="picker" :data-error="error || ''"><input data-testid="picker-query" :id="id + '-search-input'" :value="query" @focus="$emit('update:open', true)" @input="$emit('update:query', $event.target.value)" /><button v-for="o in options" :key="o.value" type="button" data-testid="picker-option" :data-value="o.value" @click="toggle(o.value)">{{ o.label }}</button></div>`,
		},
		Select: {
			props: ['modelValue', 'options'],
			emits: ['update:modelValue'],
			template: `<select data-testid="payment-select" :data-value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option value=""></option><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>`,
		},
		Switch: {
			props: ['modelValue'],
			emits: ['update:modelValue'],
			template: `<button type="button" data-testid="payments-switch" :aria-checked="String(!!modelValue)" @click="$emit('update:modelValue', !modelValue)" />`,
		},
		TabButtons: {
			props: ['modelValue', 'options'],
			emits: ['update:modelValue'],
			template: `<div data-testid="tabs" :data-value="modelValue"><button v-for="o in options" :key="o.value" type="button" :data-mode="o.value" @click="$emit('update:modelValue', o.value)">{{ o.label }}</button></div>`,
		},
		Tooltip: {
			props: ['text'],
			template: `<span :data-tooltip="text"><slot /></span>`,
		},
	}
})

vi.mock('@/components/Controls/Link.vue', () => ({
	default: defineComponent({
		inheritAttrs: false,
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
		setup(props, { attrs, emit }) {
			return () =>
				h(
					'label',
					{
						'data-field': props.label || attrs['aria-label'],
						'data-doctype': props.doctype,
						'data-value': props.modelValue ?? '',
						'data-placeholder': props.placeholder,
						'data-error': props.error,
						'data-filters': JSON.stringify(props.filters ?? null),
					},
					h('input', {
						'aria-label': attrs['aria-label'] || props.label,
						'aria-invalid': props.error ? 'true' : undefined,
						value: props.modelValue,
						onInput: (event: Event) =>
							emit(
								'update:modelValue',
								(event.target as HTMLInputElement).value
							),
					})
				)
		},
	}),
}))

vi.mock('@/components/FormShell.vue', () => ({
	default: {
		props: ['title', 'size', 'position'],
		emits: ['close'],
		template: `<div><slot /><div data-testid="actions"><slot name="actions" /></div></div>`,
	},
}))

vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		props: ['label', 'variant', 'loading', 'disabled'],
		emits: ['click'],
		template: `<button type="button" v-bind="$attrs" :disabled="disabled" :data-variant="variant" @click="$emit('click')">{{ label }}</button>`,
	},
}))

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		useScreenSize: () => ({
			size: { width: 1024, height: 800 },
			isMobile: computed(() => false),
		}),
	}
})

import EnrollStudentsForm from '@/components/Enrollment/EnrollStudentsForm.vue'

const SEARCH = 'lms.lms.api.search_users_to_enroll'
const PREVIEW = 'lms.lms.api.get_bulk_enrollment_preview'
const COURSE = 'lms.lms.api.enroll_students_in_course'

const NAMES: Record<string, string> = {
	'a@x.com': 'Ann',
	'b@x.com': 'Ben',
	'c@x.com': 'Cat',
	'd@x.com': 'Dan',
}
for (let i = 0; i < 60; i++) NAMES[`s${i}@x.com`] = `Student ${i}`

const option = (email: string) => ({
	value: email,
	label: NAMES[email],
	description: email,
	image: null,
})

const statusOf: Record<string, EnrollStatus> = reactive({})
const linkableOf: Record<string, LinkablePayment[]> = reactive({})
const submitted: Record<string, unknown>[] = []
let submitAnswer: (members: string[]) => unknown

const paidCourse: EnrollTarget = {
	doctype: 'LMS Course',
	name: 'C1',
	paidKind: 'course',
	priceLabel: '₹100',
}

beforeEach(() => {
	for (const key of Object.keys(statusOf)) delete statusOf[key]
	for (const key of Object.keys(linkableOf)) delete linkableOf[key]
	submitted.length = 0
	callMock.mockReset()
	for (const mock of Object.values(toastMock)) mock.mockReset()
	submitAnswer = (members) => ({ added: members, errors: [] })
	api[SEARCH] = (params) => {
		const names = params.names
			? (JSON.parse(String(params.names)) as string[])
			: Object.keys(NAMES).filter((email) =>
					email.includes(String(params.txt ?? ''))
			  )
		return names
			.filter((email) => NAMES[email])
			.slice(0, Number(params.page_length) || 20)
			.map(option)
	}
	api[PREVIEW] = (params) => ({
		rows: (JSON.parse(String(params.members)) as string[]).map((member) => ({
			member,
			full_name: NAMES[member],
			user_image: null,
			status: statusOf[member] ?? 'ready',
			linkable_payments: linkableOf[member] ?? [],
		})),
		seats_left: null,
		amount: 100,
		currency: 'INR',
	})
	api[COURSE] = (params) => {
		submitted.push(params)
		return submitAnswer(JSON.parse(String(params.members)))
	}
})

type Wrapper = VueWrapper

const settle = () => flushPromises()

const paste = async (wrapper: Wrapper, emails: string[]) => {
	await wrapper
		.get('[data-testid="picker-query"]')
		.setValue(`${emails.join(', ')},`)
	await settle()
}

const openDialog = async (
	emails: string[],
	target: EnrollTarget = paidCourse
) => {
	const wrapper = mount(EnrollStudentsForm, {
		props: { target, refusal: '', loading: false },
		attachTo: document.body,
		global: { mocks: { __: translate } },
	})
	if (emails.length) await paste(wrapper, emails)
	return wrapper
}

const has = (wrapper: Wrapper, id: string) =>
	wrapper.find(`[data-testid="${id}"]`).exists()
const textOf = (wrapper: Wrapper, id: string) =>
	wrapper.get(`[data-testid="${id}"]`).text()
const press = async (wrapper: Wrapper, id: string) => {
	await wrapper.get(`[data-testid="${id}"]`).trigger('click')
	await settle()
}

const rowEl = (wrapper: Wrapper, member: string) =>
	wrapper.get(`[data-testid="student-row"][data-member="${member}"]`)
const tickRow = async (wrapper: Wrapper, ...members: string[]) => {
	for (const member of members) {
		await rowEl(wrapper, member)
			.get('[data-slot="list-row-checkbox"]')
			.trigger('click')
	}
	await settle()
}
const tickedRows = (wrapper: Wrapper) =>
	wrapper
		.findAll('[data-testid="student-row"]')
		.filter(
			(row) =>
				row
					.find('[data-slot="list-row-checkbox"]')
					.attributes('aria-checked') === 'true'
		)
		.map((row) => row.attributes('data-member'))
/** A table cell; with the panel open, Payment moves under the name. */
const column = (wrapper: Wrapper, member: string, col: string) => {
	const row = rowEl(wrapper, member)
	const cell = row.find(`[data-col="${col}"]`)
	if (cell.exists() || col !== 'payment') return cell.text()
	return row.get('[data-testid="student-sub"]').text()
}

const panel = (wrapper: Wrapper) => wrapper.get('[data-testid="payment-panel"]')
const panelOpen = (wrapper: Wrapper) => has(wrapper, 'payment-panel')
const panelTitle = (wrapper: Wrapper) => textOf(wrapper, 'panel-title')
const closePanel = (wrapper: Wrapper) => press(wrapper, 'payment-panel-close')

const fieldEl = (wrapper: Wrapper, name: string) =>
	panel(wrapper).get(`[data-field="${name}"]`)
const hasField = (wrapper: Wrapper, name: string) =>
	panel(wrapper).find(`[data-field="${name}"]`).exists()
/** What the field is bound to, and the placeholder behind it. */
const shown = (wrapper: Wrapper, name: string) => {
	const el = fieldEl(wrapper, name)
	return {
		value: el.attributes('data-value'),
		placeholder: el.attributes('data-placeholder'),
	}
}
const valueOf = (wrapper: Wrapper, name: string) =>
	fieldEl(wrapper, name).attributes('data-value')
const type = async (wrapper: Wrapper, name: string, value: string) => {
	await fieldEl(wrapper, name).get('input').setValue(value)
	await settle()
}
/** Backspace one character at a time down to empty. */
const backspace = async (wrapper: Wrapper, name: string) => {
	let text = valueOf(wrapper, name) ?? ''
	while (text.length) {
		text = text.slice(0, -1)
		await type(wrapper, name, text)
	}
}

const ADDRESS = ['Address line 1', 'City', 'Country']
const ALL_ADDRESS = [
	'Address line 1',
	'City',
	'Country',
	'Address line 2',
	'State',
	'Postal code',
]
const fillAddress = async (
	wrapper: Wrapper,
	[line1, city, country]: [string, string, string]
) => {
	await type(wrapper, 'Address line 1', line1)
	await type(wrapper, 'City', city)
	await type(wrapper, 'Country', country)
}
const addressValues = (wrapper: Wrapper) =>
	ADDRESS.map((name) => valueOf(wrapper, name))

const missingNote = (wrapper: Wrapper) =>
	panel(wrapper).find('[data-testid="missing-details"]').exists()
		? textOf(wrapper, 'missing-details')
		: ''

const footerButton = (wrapper: Wrapper, id: string) =>
	wrapper.find(`[data-testid="actions"] [data-testid="${id}"]`)
const submitButton = (wrapper: Wrapper) =>
	wrapper.get('[data-testid="enroll-submit"]')
const reason = (wrapper: Wrapper) =>
	has(wrapper, 'enroll-reason') ? textOf(wrapper, 'enroll-reason') : ''
const detailsLabel = (wrapper: Wrapper) =>
	footerButton(wrapper, 'enroll-details').exists()
		? footerButton(wrapper, 'enroll-details').text()
		: ''

const enroll = async (wrapper: Wrapper) => {
	expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
	await press(wrapper, 'enroll-submit')
	return submitted.at(-1)!
}
const json = (params: Record<string, unknown>, key: string) =>
	params[key] === undefined ? undefined : JSON.parse(String(params[key]))

const inr = (amount: number) => formatMoney(amount, 'INR')

/** Opens the details for all and gives the common details a full address. */
const commonAddress = async (
	wrapper: Wrapper,
	address: [string, string, string] = ['1 Main St', 'Pune', 'India']
) => {
	await press(wrapper, 'enroll-details')
	await fillAddress(wrapper, address)
	await closePanel(wrapper)
}

/** Ticks `members` with the panel closed and opens their details. */
const editGroup = async (wrapper: Wrapper, ...members: string[]) => {
	await tickRow(wrapper, ...members)
	await press(wrapper, 'enroll-details')
}

describe('Enroll Students dialog, end to end', () => {
	it('starts on the details for all until everyone has an address, then enrolls the common details', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		expect(column(wrapper, 'a@x.com', 'payment')).toBe(inr(100))
		expect(rowEl(wrapper, 'a@x.com').find('[data-col="billing"]').text()).toBe(
			'Requires address'
		)
		expect(has(wrapper, 'enroll-submit')).toBe(false)
		expect(detailsLabel(wrapper)).toBe('Enter details for all')
		await press(wrapper, 'enroll-details')
		expect(panelTitle(wrapper)).toBe('Details for all 2 students')
		expect(tickedRows(wrapper)).toEqual(['a@x.com', 'b@x.com'])
		expect(hasField(wrapper, 'Billing name')).toBe(false)
		expect(missingNote(wrapper)).toBe('Missing: Billing address')
		await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
		expect(missingNote(wrapper)).toBe('')
		await closePanel(wrapper)
		expect(tickedRows(wrapper)).toEqual([])
		expect(column(wrapper, 'b@x.com', 'billing')).toBe('1 Main St, Pune, India')
		const params = await enroll(wrapper)
		expect(json(params, 'payment_details')).toEqual({
			amount: 100,
			currency: 'INR',
			address: {
				address_line1: '1 Main St',
				city: 'Pune',
				country: 'India',
			},
		})
		expect(params.member_payment_details).toBeUndefined()
		expect(json(params, 'linked_payments')).toEqual({})
		expect(toastMock.success).toHaveBeenCalledWith('2 students enrolled', {
			description: undefined,
		})
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('a common field emptied stays empty, is named as missing and blocks Enroll', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await press(wrapper, 'enroll-details')
		for (const name of ['Amount', 'Currency']) {
			await backspace(wrapper, name)
			expect(valueOf(wrapper, name)).toBe('')
		}
		await type(wrapper, 'Source', 'Web')
		await backspace(wrapper, 'Source')
		expect(valueOf(wrapper, 'Source')).toBe('')
		expect(missingNote(wrapper)).toBe('Missing: Amount, Currency')
		expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
		expect(reason(wrapper)).toBe(
			'Fill in Amount and Currency in the details for all'
		)
		expect(column(wrapper, 'a@x.com', 'payment')).toBe('—')
	})

	it('clearing every common address field leaves them empty and asks for an address', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await press(wrapper, 'enroll-details')
		await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
		for (const name of ADDRESS) await backspace(wrapper, name)
		expect(addressValues(wrapper)).toEqual(['', '', ''])
		expect(missingNote(wrapper)).toBe('Missing: Billing address')
	})

	it('with one student ticked, shows the common values and edits only them', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		expect(panelTitle(wrapper)).toBe('Ann')
		expect(shown(wrapper, 'Amount').value).toBe('100')
		expect(shown(wrapper, 'Currency').value).toBe('INR')
		expect(shown(wrapper, 'Billing name')).toEqual({
			value: '',
			placeholder: 'Ann',
		})
		expect(addressValues(wrapper)).toEqual(['1 Main St', 'Pune', 'India'])
		await type(wrapper, 'Amount', '40')
		await type(wrapper, 'Billing name', 'Acme')
		expect(column(wrapper, 'a@x.com', 'payment')).toContain(inr(40))
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'payment')).toBe(inr(40))
		expect(column(wrapper, 'b@x.com', 'payment')).toBe(inr(100))
		const params = await enroll(wrapper)
		expect(json(params, 'member_payment_details')).toEqual({
			'a@x.com': { amount: 40, billing_name: 'Acme' },
		})
	})

	it.each(['Amount', 'Currency', 'Source', 'Billing name'])(
		'%s emptied for ticked students stays empty, inherits the common value and shows it as placeholder',
		async (name) => {
			const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
			await press(wrapper, 'enroll-details')
			await type(wrapper, 'Source', 'Web')
			await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
			await closePanel(wrapper)
			await editGroup(wrapper, 'a@x.com', 'b@x.com')
			await type(wrapper, name, name === 'Amount' ? '55' : 'Own')
			await backspace(wrapper, name)
			const placeholder = {
				Amount: '100',
				Currency: 'INR',
				Source: 'Web',
				'Billing name': "Each student's name",
			}[name]
			expect(shown(wrapper, name)).toEqual({ value: '', placeholder })
			await type(wrapper, 'City', 'Mumbai')
			expect(shown(wrapper, name).value).toBe('')
			await closePanel(wrapper)
			const params = await enroll(wrapper)
			const own = json(params, 'member_payment_details')
			for (const member of ['a@x.com', 'b@x.com']) {
				expect(Object.keys(own[member])).toEqual(['address'])
			}
		}
	)

	// Everyone ticked with one own value edits them as a group. Emptying that
	// value used to flip the panel to the details for all mid-edit, refilling
	// the field with the common value.
	it('with everyone ticked, clearing the last own value keeps the group and the field empty', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await press(wrapper, 'enroll-details')
		await type(wrapper, 'Source', 'Web')
		await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
		await closePanel(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Source', 'Referral')
		await closePanel(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		expect(panelTitle(wrapper)).toBe('Details for 2 students')
		expect(shown(wrapper, 'Source')).toEqual({
			value: '',
			placeholder: 'Varies',
		})
		await type(wrapper, 'Source', 'X')
		await backspace(wrapper, 'Source')
		expect(panelTitle(wrapper)).toBe('Details for 2 students')
		expect(shown(wrapper, 'Source')).toEqual({ value: '', placeholder: 'Web' })
		expect(hasField(wrapper, 'Billing name')).toBe(true)
	})

	it('typing the common value for ticked students keeps the panel and records no override', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Amount', '7')
		await closePanel(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await type(wrapper, 'Amount', '100')
		expect(panelTitle(wrapper)).toBe('Details for 2 students')
		await type(wrapper, 'Amount', '1000')
		expect(valueOf(wrapper, 'Amount')).toBe('1000')
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'payment')).toBe(inr(1000))
		const params = await enroll(wrapper)
		expect(json(params, 'payment_details').amount).toBe(100)
	})

	it('shows the shared value, not Varies, once an own value matches a changed common one', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Amount', '50')
		await press(wrapper, 'selection-clear')
		expect(panelTitle(wrapper)).toBe('Details for all 2 students')
		await type(wrapper, 'Amount', '50')
		await closePanel(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		expect(shown(wrapper, 'Amount')).toEqual({ value: '50', placeholder: '50' })
	})

	it('shows Varies where ticked students differ and a typed value overrides them all', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Amount', '50')
		await closePanel(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		expect(shown(wrapper, 'Amount')).toEqual({
			value: '',
			placeholder: 'Varies',
		})
		await type(wrapper, 'Amount', '60')
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'payment')).toBe(inr(60))
		expect(column(wrapper, 'b@x.com', 'payment')).toBe(inr(60))
		expect(column(wrapper, 'c@x.com', 'payment')).toBe(inr(100))
	})

	it('editing an inherited address for ticked students copies the common one', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await backspace(wrapper, 'City')
		await type(wrapper, 'City', 'Goa')
		expect(addressValues(wrapper)).toEqual(['1 Main St', 'Goa', 'India'])
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'billing')).toBe('1 Main St, Goa, India')
		expect(column(wrapper, 'c@x.com', 'billing')).toBe('1 Main St, Pune, India')
	})

	it('clearing every address field for ticked students leaves them empty, not refilled with the common one', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		for (const name of ADDRESS) await backspace(wrapper, name)
		expect(addressValues(wrapper)).toEqual(['', '', ''])
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'billing')).toBe('Requires address')
		expect(detailsLabel(wrapper)).toBe('Enter details for Ann')
	})

	it('Add new address, typed and backspaced, stays a new empty address', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await press(wrapper, 'address-use-existing')
		await press(wrapper, 'address-add-new')
		expect(addressValues(wrapper)).toEqual(['', '', ''])
		await type(wrapper, 'City', 'G')
		await backspace(wrapper, 'City')
		expect(addressValues(wrapper)).toEqual(['', '', ''])
		expect(missingNote(wrapper)).toBe('Missing: Billing address')
	})

	const differing = async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await backspace(wrapper, 'City')
		await type(wrapper, 'City', 'Goa')
		await closePanel(wrapper)
		return wrapper
	}

	it('with everyone ticked and one address different, notes it instead of the common address', async () => {
		const wrapper = await differing()
		await press(wrapper, 'enroll-details')
		expect(tickedRows(wrapper)).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
		expect(panelTitle(wrapper)).toBe('Details for all 3 students')
		await closePanel(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com', 'c@x.com')
		expect(panelTitle(wrapper)).toBe('Details for 3 students')
		expect(textOf(wrapper, 'address-differs')).toContain(
			'Different addresses for these 3 students'
		)
		expect(panel(wrapper).find('[data-testid="address-fields"]').exists()).toBe(
			false
		)
		expect(hasField(wrapper, 'Phone')).toBe(false)
	})

	it('Overwrite, typed then emptied, stays an empty new address for every ticked student', async () => {
		const wrapper = await differing()
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await press(wrapper, 'address-overwrite')
		expect(addressValues(wrapper)).toEqual(['', '', ''])
		await type(wrapper, 'City', 'D')
		await backspace(wrapper, 'City')
		expect(addressValues(wrapper)).toEqual(['', '', ''])
		expect(has(wrapper, 'address-differs')).toBe(false)
		await fillAddress(wrapper, ['2 Hill Rd', 'Delhi', 'India'])
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'billing')).toBe(
			'2 Hill Rd, Delhi, India'
		)
		expect(column(wrapper, 'b@x.com', 'billing')).toBe(
			'2 Hill Rd, Delhi, India'
		)
		expect(column(wrapper, 'c@x.com', 'billing')).toBe('1 Main St, Pune, India')
	})

	it('Overwrite then Cancel puts every address back', async () => {
		const wrapper = await differing()
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await press(wrapper, 'address-overwrite')
		await fillAddress(wrapper, ['2 Hill Rd', 'Delhi', 'India'])
		await press(wrapper, 'address-cancel')
		expect(has(wrapper, 'address-differs')).toBe(true)
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'billing')).toBe('1 Main St, Goa, India')
		expect(column(wrapper, 'b@x.com', 'billing')).toBe('1 Main St, Pune, India')
	})

	it('Reset after Overwrite leaves nothing for Cancel to undo', async () => {
		const wrapper = await differing()
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await press(wrapper, 'address-overwrite')
		await fillAddress(wrapper, ['2 Hill Rd', 'Delhi', 'India'])
		await press(wrapper, 'selection-reset')
		expect(has(wrapper, 'address-cancel')).toBe(false)
		expect(addressValues(wrapper)).toEqual(['1 Main St', 'Pune', 'India'])
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'billing')).toBe('1 Main St, Pune, India')
	})

	it('Reset brings back the inherited values in fields that were emptied', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await type(wrapper, 'Amount', '5')
		await backspace(wrapper, 'Amount')
		await press(wrapper, 'selection-reset')
		expect(shown(wrapper, 'Amount').value).toBe('100')
	})

	it('Reset with everyone ticked goes back to the details for all', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Amount', '5')
		await tickRow(wrapper, 'b@x.com')
		expect(panelTitle(wrapper)).toBe('Details for 2 students')
		await press(wrapper, 'selection-reset')
		expect(panelTitle(wrapper)).toBe('Details for all 2 students')
	})

	it('the existing-address picker closes when the ticked students change', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await editGroup(wrapper, 'a@x.com')
		await press(wrapper, 'address-use-existing')
		expect(hasField(wrapper, 'Existing address')).toBe(true)
		await tickRow(wrapper, 'b@x.com')
		expect(hasField(wrapper, 'Existing address')).toBe(false)
		expect(has(wrapper, 'address-fields')).toBe(true)
	})

	it('a student linking a payment is left out of group edits', async () => {
		linkableOf['a@x.com'] = [
			{ name: 'PAY-1', amount: 100, currency: 'INR', creation: '2026-01-01' },
		]
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await panel(wrapper).get('[data-mode="link"]').trigger('click')
		await settle()
		expect(hasField(wrapper, 'Amount')).toBe(false)
		await closePanel(wrapper)
		expect(reason(wrapper)).toBe('Choose a payment to link for Ann')
		await editGroup(wrapper, 'a@x.com')
		await panel(wrapper).get('[data-testid="payment-select"]').setValue('PAY-1')
		await settle()
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'billing')).toBe('—')
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await type(wrapper, 'Amount', '70')
		await closePanel(wrapper)
		const params = await enroll(wrapper)
		expect(json(params, 'linked_payments')).toEqual({ 'a@x.com': 'PAY-1' })
		expect(json(params, 'member_payment_details')).toEqual({
			'b@x.com': { amount: 70 },
		})
	})

	it('names the students still missing details and ticks just them', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await editGroup(wrapper, 'a@x.com')
		await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
		await closePanel(wrapper)
		expect(detailsLabel(wrapper)).toBe('Enter details for 2 students')
		await press(wrapper, 'enroll-details')
		expect(tickedRows(wrapper)).toEqual(['b@x.com', 'c@x.com'])
		await fillAddress(wrapper, ['2 Hill Rd', 'Delhi', 'India'])
		await closePanel(wrapper)
		expect(detailsLabel(wrapper)).toBe('Enter details for all')
		expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
	})

	it('with the common amount missing, Enter details opens the details for all even when some have their own', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Amount', '30')
		await closePanel(wrapper)
		await press(wrapper, 'enroll-details')
		await backspace(wrapper, 'Amount')
		await closePanel(wrapper)
		expect(reason(wrapper)).toBe('Fill in Amount in the details for all')
		expect(detailsLabel(wrapper)).toBe('Enter details for all')
		await press(wrapper, 'enroll-details')
		expect(panelTitle(wrapper)).toBe('Details for all 2 students')
		await type(wrapper, 'Amount', '90')
		await closePanel(wrapper)
		const params = await enroll(wrapper)
		expect(json(params, 'payment_details').amount).toBe(90)
	})

	it('does not ask for a common address nobody uses', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		expect(panelTitle(wrapper)).toBe('Details for all 2 students')
		await closePanel(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
		await closePanel(wrapper)
		await editGroup(wrapper, 'b@x.com')
		await fillAddress(wrapper, ['2 Hill Rd', 'Delhi', 'India'])
		await closePanel(wrapper)
		expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
		await press(wrapper, 'enroll-details')
		expect(panelTitle(wrapper)).toBe('Details for all 2 students')
		expect(missingNote(wrapper)).toBe('')
	})

	it('a one-student list edits the common details under their name and enrolls', async () => {
		const wrapper = await openDialog(['a@x.com'])
		expect(detailsLabel(wrapper)).toBe('Enter details for Ann')
		await press(wrapper, 'enroll-details')
		expect(panelTitle(wrapper)).toBe('Ann')
		expect(hasField(wrapper, 'Billing name')).toBe(true)
		await backspace(wrapper, 'Currency')
		await type(wrapper, 'Currency', 'USD')
		await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
		await type(wrapper, 'Billing name', 'Acme')
		await closePanel(wrapper)
		const params = await enroll(wrapper)
		expect(json(params, 'payment_details')).toMatchObject({ currency: 'USD' })
		expect(json(params, 'member_payment_details')).toEqual({
			'a@x.com': { billing_name: 'Acme' },
		})
	})

	it('ticking the only student edits the details for all under their name', async () => {
		const wrapper = await openDialog(['a@x.com'])
		await tickRow(wrapper, 'a@x.com')
		await press(wrapper, 'enroll-details')
		expect(panelTitle(wrapper)).toBe('Ann')
		await type(wrapper, 'Amount', '80')
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'payment')).toBe(inr(80))
		await press(wrapper, 'enroll-details')
		expect(valueOf(wrapper, 'Amount')).toBe('80')
	})

	it('a one-student list with their own billing name still reaches a missing common amount', async () => {
		const wrapper = await openDialog(['a@x.com'])
		await press(wrapper, 'enroll-details')
		await fillAddress(wrapper, ['1 Main St', 'Pune', 'India'])
		await type(wrapper, 'Billing name', 'Acme')
		await backspace(wrapper, 'Amount')
		await closePanel(wrapper)
		expect(reason(wrapper)).toBe('Fill in Amount in the details for all')
		await press(wrapper, 'enroll-details')
		await type(wrapper, 'Amount', '60')
		await closePanel(wrapper)
		const params = await enroll(wrapper)
		expect(json(params, 'payment_details').amount).toBe(60)
	})

	it('adding a student under an everyone-ticked panel edits the ticked ones as a group', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await press(wrapper, 'enroll-details')
		expect(panelTitle(wrapper)).toBe('Details for all 2 students')
		await paste(wrapper, ['c@x.com'])
		expect(panelTitle(wrapper)).toBe('Details for 2 students')
		await type(wrapper, 'Amount', '20')
		await closePanel(wrapper)
		expect(column(wrapper, 'c@x.com', 'payment')).toBe(inr(100))
	})

	it('a group can link one existing address, shown in Billing and sent by name', async () => {
		callMock.mockResolvedValue({
			address_line1: '9 Bay Rd',
			city: 'Kochi',
			country: 'India',
		})
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await press(wrapper, 'address-use-existing')
		expect(
			JSON.parse(
				fieldEl(wrapper, 'Existing address').attributes('data-filters')!
			)
		).toEqual({ address_type: 'Billing' })
		await type(wrapper, 'Existing address', 'ADDR-7')
		expect(textOf(wrapper, 'saved-address')).toContain('9 Bay Rd, Kochi, India')
		expect(hasField(wrapper, 'Phone')).toBe(false)
		await closePanel(wrapper)
		expect(column(wrapper, 'b@x.com', 'billing')).toBe('9 Bay Rd, Kochi, India')
		const params = await enroll(wrapper)
		expect(json(params, 'member_payment_details')).toEqual({
			'a@x.com': { address: 'ADDR-7' },
			'b@x.com': { address: 'ADDR-7' },
		})
	})

	it('a group of linked students has no payment fields to fill', async () => {
		for (const member of ['a@x.com', 'b@x.com']) {
			linkableOf[member] = [
				{
					name: `PAY-${member}`,
					amount: 100,
					currency: 'INR',
					creation: '2026-01-01',
				},
			]
		}
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		for (const member of ['a@x.com', 'b@x.com']) {
			await editGroup(wrapper, member)
			await panel(wrapper).get('[data-mode="link"]').trigger('click')
			await panel(wrapper)
				.get('[data-testid="payment-select"]')
				.setValue(`PAY-${member}`)
			await settle()
			await closePanel(wrapper)
		}
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		expect(hasField(wrapper, 'Amount')).toBe(false)
		expect(has(wrapper, 'address-fields')).toBe(false)
	})

	it('turning payments off mid-edit closes the panel and enrolls without payments', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Amount', '5')
		await press(wrapper, 'payments-switch')
		expect(panelOpen(wrapper)).toBe(false)
		expect(tickedRows(wrapper)).toEqual([])
		expect(has(wrapper, 'enroll-details')).toBe(false)
		const params = await enroll(wrapper)
		expect(params.payment_details).toBeUndefined()
		expect(params.linked_payments).toBeUndefined()
		expect(params.member_payment_details).toBeUndefined()
	})

	it('turning payments back on keeps what was entered', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com')
		await type(wrapper, 'Amount', '5')
		await closePanel(wrapper)
		await press(wrapper, 'payments-switch')
		await press(wrapper, 'payments-switch')
		expect(column(wrapper, 'a@x.com', 'payment')).toBe(inr(5))
		expect(column(wrapper, 'b@x.com', 'billing')).toBe('1 Main St, Pune, India')
	})

	it('banner Remove drops the ticked students and their details', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'a@x.com', 'b@x.com')
		await type(wrapper, 'Amount', '5')
		await press(wrapper, 'selection-remove')
		expect(wrapper.findAll('[data-testid="student-row"]')).toHaveLength(1)
		expect(panelTitle(wrapper)).toBe('Cat')
		await paste(wrapper, ['a@x.com'])
		await closePanel(wrapper)
		expect(column(wrapper, 'a@x.com', 'payment')).toBe(inr(100))
	})

	it('banner Select all and x tick everyone and nobody', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com', 'c@x.com'])
		await tickRow(wrapper, 'a@x.com')
		await press(wrapper, 'selection-select-all')
		expect(tickedRows(wrapper)).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
		await press(wrapper, 'selection-clear')
		expect(tickedRows(wrapper)).toEqual([])
	})

	it('caps the list at 50 and says so', async () => {
		const many = Array.from({ length: 52 }, (_, i) => `s${i}@x.com`)
		const wrapper = await openDialog(many, { ...paidCourse, paidKind: null })
		expect(wrapper.findAll('[data-testid="student-row"]')).toHaveLength(50)
		expect(
			wrapper.get('[data-testid="picker"]').attributes('data-error')
		).toContain('up to 50')
		expect(submitButton(wrapper).text()).toBe('Enroll 50 students')
	})

	it('adds from the search, ignores unknown pasted emails and removes a ticked student', async () => {
		const wrapper = await openDialog([], { ...paidCourse, paidKind: null })
		expect(has(wrapper, 'selected-empty')).toBe(true)
		await wrapper.get('[data-testid="picker-query"]').trigger('focus')
		await settle()
		await wrapper
			.get('[data-testid="picker-option"][data-value="b@x.com"]')
			.trigger('click')
		await settle()
		await paste(wrapper, ['a@x.com', 'nobody@x.com'])
		expect(
			wrapper
				.findAll('[data-testid="student-row"]')
				.map((row) => row.attributes('data-member'))
		).toEqual(['b@x.com', 'a@x.com'])
		await tickRow(wrapper, 'b@x.com')
		await press(wrapper, 'selection-remove')
		const params = await enroll(wrapper)
		expect(json(params, 'members')).toEqual(['a@x.com'])
	})

	it('keeps Enroll disabled until every pasted list is checked', async () => {
		const wrapper = await openDialog(['a@x.com'], {
			...paidCourse,
			paidKind: null,
		})
		const answers: (() => void)[] = []
		const search = api[SEARCH]
		api[SEARCH] = (params) =>
			new Promise((resolve) => answers.push(() => resolve(search(params))))
		await wrapper
			.get('[data-testid="picker-query"]')
			.setValue('b@x.com, c@x.com')
		await wrapper
			.get('[data-testid="picker-query"]')
			.setValue('d@x.com, s1@x.com')
		answers[0]()
		await settle()
		expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
		answers[1]()
		await settle()
		expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
	})

	it('on partial failure warns and keeps only the failed students with their details', async () => {
		const wrapper = await openDialog(['a@x.com', 'b@x.com'])
		await commonAddress(wrapper)
		await editGroup(wrapper, 'b@x.com')
		await type(wrapper, 'Amount', '5')
		await closePanel(wrapper)
		submitAnswer = () => ({
			added: ['a@x.com'],
			errors: [{ member: 'b@x.com', error: 'Already paid' }],
		})
		await enroll(wrapper)
		expect(toastMock.warning).toHaveBeenCalledWith(
			'1 student enrolled, 1 student could not be enrolled',
			{ description: 'b@x.com: Already paid' }
		)
		expect(wrapper.emitted('close')).toBeUndefined()
		expect(
			wrapper
				.findAll('[data-testid="student-row"]')
				.map((row) => row.attributes('data-member'))
		).toEqual(['b@x.com'])
		expect(column(wrapper, 'b@x.com', 'payment')).toBe(inr(5))
		const params = await enroll(wrapper)
		expect(json(params, 'members')).toEqual(['b@x.com'])
		expect(json(params, 'member_payment_details')).toEqual({
			'b@x.com': { amount: 5 },
		})
	})

	it('toasts the error and stays when nobody could be enrolled', async () => {
		const wrapper = await openDialog(['a@x.com'], {
			...paidCourse,
			paidKind: null,
		})
		submitAnswer = () => ({
			added: [],
			errors: [{ member: 'a@x.com', error: 'Disabled' }],
		})
		await enroll(wrapper)
		expect(toastMock.error).toHaveBeenCalledWith(
			'1 student could not be enrolled',
			{ description: 'a@x.com: Disabled' }
		)
		expect(wrapper.findAll('[data-testid="student-row"]')).toHaveLength(1)
	})
})
