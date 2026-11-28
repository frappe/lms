import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchOverlay from '@/pages/Batches/components/BatchOverlay.vue'
import BatchForm from '@/pages/Batches/BatchForm.vue'
import { enrollmentClosesLabel } from '@/utils/batchEnrollment'

const { formDoc } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { formDoc: {} as Record<string, unknown> }
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
	useSettings: () => ({ settings: { data: { is_payments_app_installed: 1 } } }),
}))
vi.mock('@/pages/Batches/composables/useBatchForm', () => ({
	injectBatchForm: () => ({
		doc: computed(() => formDoc),
		meta: { description: '', keywords: '' },
		people: { value: [] },
	}),
}))

const settingSwitch = {
	name: 'SettingSwitch',
	props: ['modelValue', 'label', 'summary'],
	emits: ['update:modelValue'],
	template: '<div class="switch">{{ label }} {{ summary }}</div>',
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
				SettingLink: true,
				SettingField: true,
				SettingImage: true,
				SearchPreview: true,
				PeopleGroup: true,
				EvaluationGroup: true,
				BatchManageGroup: true,
				PaymentsAppDialog: true,
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

describe('late enrolment settings', () => {
	it('shows the last enrolment date only while late enrolment is on', async () => {
		const off = mountSettings({
			name: 'B1',
			start_date: '2026-11-01',
			end_date: '2026-12-31',
			allow_late_enrollment: false,
		})
		expect(off.text()).toContain('Allow enrolment after the batch starts')
		expect(off.text()).toContain('Enrolment closes when the batch starts.')
		expect(off.findComponent({ name: 'DatePicker' }).exists()).toBe(false)

		const on = mountSettings({
			name: 'B1',
			start_date: '2026-11-01',
			end_date: '2026-12-31',
			allow_late_enrollment: true,
		})
		const picker = on.findComponent({ name: 'DatePicker' })
		expect(picker.exists()).toBe(true)
		expect(picker.props('min')).toBe('2026-11-01')
		expect(picker.props('max')).toBe('2026-12-31')
	})
})

describe('late enrolment for learners', () => {
	it('names the closing day once a batch has started', () => {
		expect(enrollmentClosesLabel('2026-12-15')).toBe(
			'Enrolment closes on 15 Dec'
		)
		expect(enrollmentClosesLabel(null)).toBe('')
	})

	it('keeps Enroll Now on a started batch and says when enrolment closes', () => {
		const wrapper = mountOverlay({ enrollment_closes_on: '2026-12-15' })
		expect(wrapper.text()).toContain('Enroll Now')
		expect(wrapper.text()).toContain('Enrolment closes on 15 Dec')
	})

	it('says enrolment is closed once the window has passed', () => {
		const wrapper = mountOverlay({ accept_enrollments: 0 })
		expect(wrapper.text()).toContain('Enrollment for this batch is closed')
		expect(wrapper.text()).not.toContain('Enrolment closes on')
	})
})
