// The batch's own course and assessment forms tick the live class flow's
// batch steps, and record the batch they saved to as the flow's batch.
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchCourseForm from '@/pages/Forms/BatchCourseForm.vue'
// @ts-expect-error a JS SFC has no generated types (TS7016)
import AssessmentForm from '@/pages/Forms/AssessmentForm.vue'

vi.stubGlobal('__', (text: string) => text)

const { completeStepMock } = vi.hoisted(() => ({ completeStepMock: vi.fn() }))
vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({ completeStep: completeStepMock }),
}))

vi.mock('frappe-ui', () => ({
	createListResource: () => ({ insert: { loading: false } }),
	createResource: () => ({ loading: false }),
	getCachedListResource: () => null,
	getCachedResource: () => null,
	toast: { success: vi.fn(), error: vi.fn() },
	FormControl: defineComponent({ render: () => h('div') }),
}))

vi.mock('vue-router', () => ({
	useRoute: () => ({ hash: '#settings' }),
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/composables/useFormRoute', () => ({
	useFormRoute: () => ({ close: vi.fn(), saveAndReplace: vi.fn() }),
}))

vi.mock('@/utils/resource', () => ({
	resourceErrorMessage: (e: unknown) => String(e),
	submitResource: (
		_resource: unknown,
		_params: unknown,
		options: { onSuccess: () => void }
	) => options.onSuccess(),
}))

const passThrough = defineComponent({
	setup:
		(_props, { slots }) =>
		() =>
			h('div', [slots.default?.(), slots.actions?.()]),
})

const saveButton = defineComponent({
	props: { label: String },
	emits: ['click'],
	setup:
		(props, { emit }) =>
		() =>
			h('button', { onClick: () => emit('click') }, props.label),
})

function save(form: typeof BatchCourseForm) {
	const w = mount(form, {
		props: { batchName: 'BATCH-1' },
		global: {
			provide: { $user: { data: { is_moderator: true } } },
			mocks: { __: (text: string) => text },
			stubs: {
				FormShell: passThrough,
				HeaderButton: saveButton,
				Link: true,
			},
		},
	})
	return w.find('button').trigger('click').then(flushPromises)
}

describe('batch forms tick the batch steps', () => {
	// Guards: Add courses to the batch never ticking from the form that adds
	// one. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the completion and the recorded batch.
	it('adding a course completes add_batch_course for that batch', async () => {
		completeStepMock.mockClear()
		await save(BatchCourseForm)
		expect(completeStepMock).toHaveBeenCalledWith('add_batch_course', {
			first_batch: 'BATCH-1',
		})
	})

	// Guards: Add assessments to the batch never ticking from the form that
	// adds one. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the completion and the recorded batch.
	it('adding an assessment completes add_batch_assessment for that batch', async () => {
		completeStepMock.mockClear()
		await save(AssessmentForm)
		expect(completeStepMock).toHaveBeenCalledWith('add_batch_assessment', {
			first_batch: 'BATCH-1',
		})
	})
})
