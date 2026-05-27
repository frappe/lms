/**
 * Component-level tests for SettingFields.vue.
 *
 * These exist because the pure-helper tests in lessonProgress.test.ts
 * passed while the actual settings dialog was broken (FormControl bound
 * to the wrong v-model target, watcher clobbering typed input). The
 * tests below mount the component, simulate the real interactions, and
 * assert against the `data` object that the parent dialog persists.
 */
import { describe, expect, it, vi } from 'vitest'

// frappe-ui's internal module resolution doesn't work under vitest;
// stub the named exports SettingFields actually imports.
vi.mock('frappe-ui', () => ({
	FormControl: {
		props: ['modelValue', 'label', 'type'],
		emits: ['update:modelValue'],
		template: `
			<input
				:data-testid="label"
				:type="type"
				:value="modelValue"
				@input="$emit('update:modelValue', $event.target.value)"
			/>
		`,
	},
	Switch: {
		props: ['modelValue', 'label'],
		emits: ['update:modelValue'],
		template: `
			<button
				:data-testid="label"
				:data-checked="modelValue ? 'true' : 'false'"
				@click="$emit('update:modelValue', !modelValue)"
			/>
		`,
	},
	FileUploader: { template: '<div />' },
	Button: { template: '<button />' },
}))
// Same for the project-local controls.
vi.mock('@/components/Controls/Link.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Controls/CodeEditor.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils', () => ({ validateFile: () => true }))
vi.mock('lucide-vue-next', () => ({ X: { template: '<i />' } }))

import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import SettingFields from '@/components/Settings/SettingFields.vue'

const mountFields = (sections: any[], data: any) =>
	mount(SettingFields, {
		props: { sections, data },
		global: { mocks: { __: (s: string) => s } },
	})

describe('SettingFields — number input persists to data', () => {
	it('typing into a number field updates data[field.name]', async () => {
		const sections = reactive([
			{
				columns: [
					{
						fields: [
							{
								label: 'Lesson dwell time',
								name: 'lesson_dwell_time',
								type: 'number',
								default: 30,
							},
						],
					},
				],
			},
		])
		const data = reactive({ lesson_dwell_time: 30 })
		const wrapper = mountFields(sections, data)
		await flushPromises()

		const input = wrapper.get('[data-testid="Lesson dwell time"]')
		await input.setValue('1')

		// FormControl is v-modeled on data[field.name], so typing must
		// reach `data` directly. If a future refactor v-models on
		// field.value without syncing, this assertion fails.
		expect(data.lesson_dwell_time).toBe('1')
	})

	it('toggling a checkbox does NOT clobber an already-typed number input', async () => {
		const sections = reactive([
			{
				columns: [
					{
						fields: [
							{
								label: 'Lesson dwell time',
								name: 'lesson_dwell_time',
								type: 'number',
								default: 30,
							},
						],
					},
					{
						fields: [
							{
								label: 'Enforce video',
								name: 'enforce_video_completion',
								type: 'checkbox',
								default: 0,
							},
						],
					},
				],
			},
		])
		const data = reactive({
			lesson_dwell_time: 30,
			enforce_video_completion: 0,
		})
		const wrapper = mountFields(sections, data)
		await flushPromises()

		// 1) User changes dwell time
		await wrapper.get('[data-testid="Lesson dwell time"]').setValue('1')
		expect(data.lesson_dwell_time).toBe('1')

		// 2) User toggles a checkbox afterwards
		await wrapper.get('[data-testid="Enforce video"]').trigger('click')
		await flushPromises()
		await nextTick()

		// The previously-typed dwell time must survive — the watcher
		// must NOT sync the stale field.value over the user's input.
		expect(data.lesson_dwell_time).toBe('1')
		// And the checkbox toggle must persist to data.
		expect(data.enforce_video_completion).toBe(true)
	})
})

describe('SettingFields — defaults surface in the input when data is empty', () => {
	it('uses field.default when data[field.name] is undefined', async () => {
		const sections = reactive([
			{
				columns: [
					{
						fields: [
							{
								label: 'Lesson dwell time',
								name: 'lesson_dwell_time',
								type: 'number',
								default: 30,
							},
						],
					},
				],
			},
		])
		const data = reactive<Record<string, unknown>>({})
		const wrapper = mountFields(sections, data)
		await flushPromises()
		await nextTick()

		// After onMounted runs, field.value should be the default;
		// the watcher (on the next mutation) is checkbox-only, but the
		// resolveInitialValue helper sets field.value at mount time.
		const field = sections[0].columns[0].fields[0] as any
		expect(field.value).toBe(30)
	})

	it('checkbox default of 1 maps to true', async () => {
		const sections = reactive([
			{
				columns: [
					{
						fields: [
							{
								label: 'Enforce quiz',
								name: 'enforce_quiz_completion',
								type: 'checkbox',
								default: 1,
							},
						],
					},
				],
			},
		])
		const data = reactive<Record<string, unknown>>({})
		const wrapper = mountFields(sections, data)
		await flushPromises()

		const field = sections[0].columns[0].fields[0] as any
		expect(field.value).toBe(true)
	})

	it('checkbox default of 0 maps to false', async () => {
		const sections = reactive([
			{
				columns: [
					{
						fields: [
							{
								label: 'Enforce video',
								name: 'enforce_video_completion',
								type: 'checkbox',
								default: 0,
							},
						],
					},
				],
			},
		])
		const data = reactive<Record<string, unknown>>({})
		const wrapper = mountFields(sections, data)
		await flushPromises()

		const field = sections[0].columns[0].fields[0] as any
		expect(field.value).toBe(false)
	})
})
