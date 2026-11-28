// Pricing and the certificate can be set from a batch's Settings tab, as on develop,
// as well as from its Overview card: both edit the same form.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import BatchForm from '@/pages/Batches/BatchForm.vue'

const { formDoc, settingsData } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		formDoc: {} as Record<string, unknown>,
		settingsData: { is_payments_app_installed: 1 },
	}
})

vi.mock('frappe-ui', () => ({
	createResource: () => ({ submit: vi.fn() }),
	toast: { success: vi.fn(), error: vi.fn() },
	Badge: { props: ['label'], template: `<span>{{ label }}</span>` },
	Button: {
		inheritAttrs: false,
		props: ['route'],
		template: `<button v-bind="$attrs"><slot /></button>`,
	},
	DatePicker: {
		name: 'DatePicker',
		props: ['modelValue', 'min', 'max'],
		template: '<input class="date" />',
	},
}))
vi.mock('vue-router', () => ({
	useRoute: () => ({ query: {}, hash: '' }),
	useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/utils', () => ({
	formatNumberIntoCurrency: (amount: number) => String(amount),
	openSettings: vi.fn(),
}))
vi.mock('@/components/VideoPreview.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/pages/Batches/components/overview/BatchFacts.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: settingsData } }),
}))
vi.mock('@/pages/Batches/composables/useBatchForm', () => ({
	injectBatchForm: () => ({
		doc: computed(() => reactive(formDoc)),
		meta: { description: '', keywords: '' },
		people: { value: [] },
		isMissing: () => false,
	}),
}))

const settingSwitch = {
	name: 'SettingSwitch',
	props: ['modelValue', 'label', 'summary'],
	emits: ['update:modelValue'],
	template:
		'<button class="switch" :data-label="label" @click="$emit(\'update:modelValue\', !modelValue)">{{ label }}</button>',
}
const settingRow = {
	props: ['label', 'summary'],
	template:
		'<div class="row">{{ label }} {{ summary }}<slot name="control" /><slot /></div>',
}

function mountSettings(doc: Record<string, unknown>) {
	Object.keys(formDoc).forEach((key) => delete formDoc[key])
	Object.assign(formDoc, reactive({ owner: 'ash@example.com', ...doc }))
	return mount(BatchForm, {
		props: { batch: { data: null } as never },
		global: {
			provide: { $user: { data: { name: 'ash@example.com' } } },
			mocks: { __: globalThis.__ },
			stubs: {
				SettingsPage: { template: '<div><slot /></div>' },
				SettingsGroup: { template: '<section><slot /></section>' },
				SettingSwitch: settingSwitch,
				SettingRow: settingRow,
				PriceInput: { name: 'PriceInput', template: '<div />' },
				SettingLink: true,
				SettingField: true,
				SettingImage: true,
				SearchPreview: true,
				PeopleGroup: true,
				EvaluationGroup: true,
				BatchManageGroup: true,
				PaymentsAppDialog: {
					name: 'PaymentsAppDialog',
					props: ['modelValue'],
					template: '<div />',
				},
			},
		},
	})
}

function mountOverlay(data: Record<string, unknown>) {
	return mount(BatchOverlay, {
		props: {
			batch: {
				data: {
					name: 'B1',
					courses: [],
					start_date: '2026-11-01',
					end_date: '2026-12-31',
					accept_enrollments: 1,
					allow_self_enrollment: 1,
					...data,
				},
			},
		},
		global: {
			provide: { $user: { data: { name: 'stu@example.com' } } },
			mocks: { __: globalThis.__ },
		},
	})
}

afterEach(() => {
	settingsData.is_payments_app_installed = 1
})

describe('batch settings pricing and certificate', () => {
	it('sells the batch from Settings, with its price', async () => {
		const wrapper = mountSettings({ name: 'B1', paid_batch: false })
		expect(wrapper.findComponent({ name: 'PriceInput' }).exists()).toBe(false)
		await wrapper.get('[data-label="Paid batch"]').trigger('click')
		expect(formDoc.paid_batch).toBe(true)
		expect(wrapper.findComponent({ name: 'PriceInput' }).exists()).toBe(true)
	})

	it('asks for the Payments app before the batch goes paid', async () => {
		settingsData.is_payments_app_installed = 0
		const wrapper = mountSettings({ name: 'B1', paid_batch: false })
		await wrapper.get('[data-label="Paid batch"]').trigger('click')

		expect(formDoc.paid_batch).toBe(false)
		expect(wrapper.findComponent({ name: 'PriceInput' }).exists()).toBe(false)
		expect(
			wrapper.findComponent({ name: 'PaymentsAppDialog' }).props('modelValue')
		).toBe(true)
	})

	it('turns on the certificate and evaluation, with its end date', async () => {
		const wrapper = mountSettings({
			name: 'B1',
			end_date: '2026-12-31',
			certification: false,
			evaluation: false,
		})
		await wrapper.get('[data-label="Certificate"]').trigger('click')
		await wrapper.get('[data-label="1-on-1 evaluation"]').trigger('click')
		expect(formDoc.certification).toBe(true)
		expect(formDoc.evaluation).toBe(true)
		const picker = wrapper.findComponent({ name: 'DatePicker' })
		expect(picker.exists()).toBe(true)
		expect(picker.props('min')).toBe('2026-12-31')
	})
})
