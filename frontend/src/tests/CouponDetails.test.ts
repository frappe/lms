/**
 * Tests for the coupon editor (CouponDetails + CouponItems).
 *
 * The coupon is saved as ONE document — the applicable_items child table rides
 * along in the save payload, and Frappe diffs the rows server-side. These tests
 * pin that contract end to end: editing an existing row in place, adding a new
 * row, and dropping half-filled rows all show up correctly in the single save.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import CouponDetails from '@/components/Settings/Coupons/CouponDetails.vue'

// frappe-ui doesn't resolve under vitest. Mock the bits the editor uses and make
// createDocumentResource controllable so we can seed the loaded doc and observe
// the save.
const { setValueSubmit, insertSubmit, reloadMock, toastMock, docHolder } =
	vi.hoisted(() => ({
		setValueSubmit: vi.fn(),
		insertSubmit: vi.fn(),
		reloadMock: vi.fn(),
		toastMock: { success: vi.fn(), error: vi.fn() },
		docHolder: { doc: null as Record<string, unknown> | null },
	}))

vi.mock('frappe-ui', () => ({
	toast: toastMock,
	Button: {
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot name="prefix" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'disabled', 'required'],
		emits: ['update:modelValue', 'input'],
		template: `<input
			:data-testid="'fc-' + label"
			:value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)"
		/>`,
	},
	createDocumentResource: () => ({
		doc: docHolder.doc,
		setValue: { submit: setValueSubmit },
		reload: vi.fn(),
	}),
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'size', 'description'],
		emits: ['update:modelValue'],
		template: `<button data-testid="switch" @click="$emit('update:modelValue', !modelValue)" />`,
	},
}))

vi.mock('@/components/Controls/Select.vue', () => ({
	default: {
		props: ['modelValue', 'options', 'label', 'required'],
		emits: ['update:modelValue'],
		template: `<select
			:data-testid="'select-' + (label || 'doctype')"
			:value="modelValue"
			@change="$emit('update:modelValue', $event.target.value)"
		><option /></select>`,
	},
}))

vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: ['doctype', 'modelValue'],
		emits: ['update:modelValue'],
		template: `<input
			:data-testid="'link-' + (modelValue ?? 'empty')"
			:value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)"
		/>`,
	},
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: { template: `<div><slot name="header-actions" /><slot /></div>` },
}))

vi.mock('lucide-vue-next', () => ({
	Plus: { template: '<i />' },
	X: { template: '<i />' },
}))

vi.stubGlobal('__', (s: string) => s)

const seedDoc = () =>
	reactive({
		name: 'WELCOME11',
		code: 'WELCOME11',
		enabled: true,
		discount_type: 'Fixed Amount',
		fixed_amount_discount: 0,
		usage_limit: 2,
		redemption_count: 0,
		expires_on: '2026-06-30',
		applicable_items: [
			{
				name: 'item-1',
				reference_doctype: 'LMS Course',
				reference_name: 'ABCE',
				parent: 'WELCOME11',
				parenttype: 'LMS Coupon',
				parentfield: 'applicable_items',
			},
		],
	})

const mountEditor = async () => {
	const wrapper = mount(CouponDetails, {
		props: {
			data: { name: 'WELCOME11' },
			coupons: {
				insert: { submit: insertSubmit },
				setValue: { submit: vi.fn() },
				reload: reloadMock,
				update: () => {},
				data: [],
			},
		} as never,
		global: { mocks: { __: (s: string) => s } },
	})
	await flushPromises()
	return wrapper
}

const clickSave = async (w: VueWrapper) => {
	const save = w.findAll('button').find((b) => b.text().trim() === 'Save')
	if (!save) throw new Error('Save button not found')
	await save.trigger('click')
	await flushPromises()
}

const clickAddRow = async (w: VueWrapper) => {
	const add = w.findAll('button').find((b) => b.text().includes('Add Row'))
	if (!add) throw new Error('Add Row button not found')
	await add.trigger('click')
	await flushPromises()
}

const savedItems = () => setValueSubmit.mock.calls[0][0].applicable_items

beforeEach(() => {
	setValueSubmit.mockReset()
	insertSubmit.mockReset()
	reloadMock.mockReset()
	toastMock.success.mockReset()
	toastMock.error.mockReset()
	docHolder.doc = seedDoc()
})

describe('coupon editor — saving applicable items', () => {
	it('persists an in-place edit of an existing row in the single save', async () => {
		const w = await mountEditor()
		await w.get('[data-testid="link-ABCE"]').setValue('ABCD')
		await clickSave(w)

		expect(setValueSubmit).toHaveBeenCalledTimes(1)
		expect(savedItems()).toEqual([
			{
				name: 'item-1',
				reference_doctype: 'LMS Course',
				reference_name: 'ABCD',
				parent: 'WELCOME11',
				parenttype: 'LMS Coupon',
				parentfield: 'applicable_items',
			},
		])
	})

	it('includes a newly added row in the save', async () => {
		const w = await mountEditor()
		await clickAddRow(w)
		await w.get('[data-testid="link-empty"]').setValue('NEW-COURSE')
		await clickSave(w)

		expect(
			savedItems().map((r: { reference_name: string }) => r.reference_name)
		).toEqual(['ABCE', 'NEW-COURSE'])
	})

	it('drops half-filled rows (no reference selected) from the save', async () => {
		const w = await mountEditor()
		await clickAddRow(w) // blank row, left unfilled
		await clickSave(w)

		expect(
			savedItems().map((r: { reference_name: string }) => r.reference_name)
		).toEqual(['ABCE'])
	})
})
