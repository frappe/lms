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
		props: ['modelValue', 'type'],
		emits: ['update:modelValue'],
		// The real SettingFields renders the label as a sibling <div>, not via a
		// FormControl label prop, so number/text inputs are selected by type.
		template: `
			<input
				:type="type"
				:value="modelValue"
				@input="$emit('update:modelValue', $event.target.value)"
			/>
		`,
	},
	Select: { props: ['modelValue', 'options'], template: '<select />' },
	FileUploader: { template: '<div />' },
	Button: { template: '<button />' },
}))
// Checkboxes use the project-local BooleanSwitch (v-modeled on data[field.name],
// the persisted source of truth) — mock it so toggling emits update:modelValue.
vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template: `
			<button
				data-testid="switch"
				:data-checked="modelValue ? 'true' : 'false'"
				@click="$emit('update:modelValue', !modelValue)"
			/>
		`,
	},
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

		const input = wrapper.get('input[type="number"]')
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
		await wrapper.get('input[type="number"]').setValue('1')
		expect(data.lesson_dwell_time).toBe('1')

		// 2) User toggles a checkbox afterwards
		await wrapper.get('[data-testid="switch"]').trigger('click')
		await flushPromises()
		await nextTick()

		// The previously-typed dwell time must survive — the watcher
		// must NOT sync the stale field.value over the user's input.
		expect(data.lesson_dwell_time).toBe('1')
		// And the checkbox toggle must persist to data.
		expect(data.enforce_video_completion).toBe(true)
	})
})

describe('SettingFields — Upload field renders both object and string values', () => {
	const uploadSections = () =>
		reactive([
			{
				columns: [
					{
						fields: [
							{
								label: 'Brand image',
								name: 'brand_image',
								type: 'Upload',
							},
						],
					},
				],
			},
		])

	// Regression: the backend (get_payment_gateway_details -> get_file_info)
	// hands back an Attach value as a {file_name, file_url} object, but the
	// template used to call data[field.name].split('/') on it, throwing
	// "split is not a function" and blanking the whole settings dialog.
	it('does not throw when the value is a {file_name, file_url} object', async () => {
		const data = reactive({
			brand_image: {
				file_name: 'logo.png',
				file_url: '/files/logo.png',
				file_size: 1234,
			},
		})
		const wrapper = mountFields(uploadSections(), data)
		await flushPromises()

		// Shows the file name from the object...
		expect(wrapper.text()).toContain('logo.png')
		// ...and the <img> src is the object's file_url, not [object Object].
		expect(wrapper.get('img').attributes('src')).toBe('/files/logo.png')
	})

	it('falls back to the URL basename when the value is a plain string', async () => {
		// A fresh upload sets data[field.name] = file.file_url (a string).
		const data = reactive({ brand_image: '/files/fresh-upload.png' })
		const wrapper = mountFields(uploadSections(), data)
		await flushPromises()

		expect(wrapper.text()).toContain('fresh-upload.png')
		expect(wrapper.get('img').attributes('src')).toBe(
			'/files/fresh-upload.png'
		)
	})

	it('renders the uploader (no image) when the value is empty', async () => {
		const data = reactive<Record<string, unknown>>({ brand_image: '' })
		const wrapper = mountFields(uploadSections(), data)
		await flushPromises()

		expect(wrapper.find('img').exists()).toBe(false)
	})
})

describe('SettingFields — checkbox defaults seed the persisted doc when empty', () => {
	it('does not seed non-checkbox defaults into data (parity: numbers bind data directly)', async () => {
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

		// Number/text/select fields bind data[field.name] directly and are never
		// seeded — matching prior behavior where an empty doc showed an empty input.
		expect(data.lesson_dwell_time).toBeUndefined()
	})

	it('checkbox default of 1 seeds data[field.name] = 1 (renders on)', async () => {
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

		expect(data.enforce_quiz_completion).toBe(1)
		expect(wrapper.get('[data-testid="switch"]').attributes('data-checked')).toBe(
			'true'
		)
	})

	it('checkbox default of 0 seeds data[field.name] = 0 (renders off)', async () => {
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

		expect(data.enforce_video_completion).toBe(0)
		expect(wrapper.get('[data-testid="switch"]').attributes('data-checked')).toBe(
			'false'
		)
	})

	it('does not overwrite a saved checkbox value with its default', async () => {
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
		// Saved as off; the default (1) must not flip it back on.
		const data = reactive<Record<string, unknown>>({ enforce_quiz_completion: 0 })
		const wrapper = mountFields(sections, data)
		await flushPromises()

		expect(data.enforce_quiz_completion).toBe(0)
	})
})
