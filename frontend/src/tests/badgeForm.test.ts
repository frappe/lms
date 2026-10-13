/**
 * The badge form: what it loads, what it lets you change, and when it saves. The
 * masthead this replaces drew Title and Description as borderless inputs, so on
 * an existing badge nothing said either could be typed into.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { saveMock, reloadMock, listReload, remove, rows, toast, call } =
	vi.hoisted(() => ({
		saveMock: vi.fn(),
		reloadMock: vi.fn(),
		listReload: vi.fn(),
		remove: vi.fn(),
		rows: [] as any[],
		toast: { success: vi.fn(), error: vi.fn() },
		call: vi.fn(() => Promise.resolve({})),
	}))

vi.mock('frappe-ui', () => ({
	call,
	toast,
	Button: {
		props: ['label', 'variant', 'loading', 'disabled'],
		emits: ['click'],
		template: `<button
			:disabled="disabled"
			:data-variant="variant"
			@click="$emit('click')"
		>{{ label }}<slot /></button>`,
	},
	ErrorMessage: {
		props: ['message'],
		template: `<div data-testid="error">{{ message }}</div>`,
	},
	FileUploader: {
		props: ['fileTypes', 'uploadArgs', 'validateFile'],
		emits: ['success'],
		template: `<div>
			<slot :uploading="false" :progress="0" :openFileSelector="() => {}" />
			<button
				data-testid="uploaded"
				@click="$emit('success', { file_url: '/files/badge.png' })"
			/>
		</div>`,
	},
	// Renders what the real control renders and nothing the old markup did: a
	// real <label for> pointing at the box, and no suppressed focus ring.
	FormControl: {
		props: {
			modelValue: {},
			label: {},
			type: {},
			placeholder: {},
			// Boolean-typed, like the real control's: Vue casts a bare `required`
			// to true only for a prop it knows is a boolean.
			required: { type: Boolean },
		},
		emits: ['update:modelValue'],
		template: `<span :data-label="label" :data-required="required ? 'yes' : 'no'">
			<label :for="'in-' + label">{{ label }}</label>
			<input
				:id="'in-' + label"
				:type="type"
				:value="modelValue"
				:placeholder="placeholder"
				@input="$emit('update:modelValue', $event.target.value)"
			/>
		</span>`,
	},
	LoadingIndicator: { template: `<span data-testid="spinner" />` },
	Select: {
		props: ['modelValue', 'label', 'options', 'required', 'ariaLabel'],
		emits: ['update:modelValue'],
		template: `<button
			:aria-label="ariaLabel"
			:data-value="modelValue"
			@click="$emit('update:modelValue', options[0].value)"
		/>`,
	},
}))

// Imported by the schema renderer, drawn by no badge field.
vi.mock('@/components/Controls/TextEditor.vue', () => ({
	default: { template: `<div data-testid="richtext" />` },
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: { template: `<div data-testid="link" />` },
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'size', 'description'],
		emits: ['update:modelValue'],
		template: `<div data-testid="switch" :data-value="String(modelValue)" />`,
	},
}))
vi.mock('@/components/Controls/CodeEditor.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'type', 'required', 'height'],
		emits: ['update:modelValue'],
		template: `<button
			data-testid="code"
			:data-value="modelValue"
			@click="$emit('update:modelValue', 'doc.progress == 100')"
		/>`,
	},
}))
vi.mock('@/components/Controls/Select.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'options', 'required'],
		emits: ['update:modelValue'],
		template: `<button
			:data-testid="'select-' + label"
			:data-value="modelValue"
			@click="$emit('update:modelValue', options[0].value)"
		/>`,
	},
}))
vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: {
		emits: ['save'],
		props: [
			'title',
			'showBack',
			'unsaved',
			'enabled',
			'saveLabel',
			'saving',
			'canSave',
			'saveTestid',
		],
		template: `<div :data-title="title" :data-unsaved="unsaved ? 'yes' : 'no'">
			<slot name="header-actions" /><button v-if="saveLabel" :data-testid="saveTestid" :disabled="!canSave" :data-loading="saving ? 'yes' : 'no'" @click="$emit('save')">{{ saveLabel }}</button><slot />
		</div>`,
	},
}))
vi.mock('@/components/Layouts/settings/desktop/SettingsList.vue', () => ({
	default: {
		props: ['title', 'columns', 'rows'],
		emits: ['new', 'rowClick', 'loadMore'],
		template: `<div data-testid="list">
			<button data-testid="new" @click="$emit('new')" />
			<button
				v-for="row in rows"
				:key="row.name"
				:data-testid="'row-' + row.name"
				@click="$emit('rowClick', row)"
			/>
		</div>`,
	},
}))

vi.mock('@/composables/useSettingsListResource', () => ({
	SETTINGS_PAGE_LENGTH: 13,
	useSettingsListResource: () => ({
		resource: {},
		search: '',
		rows,
		loading: false,
		hasNextPage: false,
		loadMore: vi.fn(),
		reload: listReload,
		applyFilters: vi.fn(),
		remove,
	}),
}))

// A stand-in for the document resource. It loads the row the page asks for,
// keeps the copy the server last sent, and calls itself dirty when the two
// differ, which is what frappe-ui's own isDirty compares.
vi.mock('@/composables/useSettingsSource', async () => {
	const { computed, reactive, ref, watch } = await import('vue')
	return {
		NEW_RECORD: 'new',
		useSettingsSource: (source: any, options: any) => {
			const doc = ref<any>(null)
			const original = ref<any>(null)
			const isNew = ref(false)

			// The list panel resolves `record: 'route'` into `{ doctype, name }`
			// before it hands the page down, so the record is read off the source
			// exactly as the real composable reads it.
			const requested = () =>
				'name' in source ? source.name : options.record?.value ?? null

			watch(
				requested,
				(name: string | null) => {
					isNew.value = name === 'new'
					if (!name) {
						doc.value = null
						original.value = null
						return
					}
					const row = rows.find((item) => item.name === name)
					// A draft opens on the page's declared defaults and is dirty
					// against them, which is the behaviour the real composable has.
					doc.value = isNew.value
						? { ...(options.defaults?.() ?? {}) }
						: { ...row }
					original.value = isNew.value
						? { ...(options.defaults?.() ?? {}) }
						: { ...row }
				},
				{ immediate: true }
			)

			return reactive({
				doc,
				name: computed(() => options.record?.value ?? null),
				isNew,
				isDirty: computed(
					() => JSON.stringify(doc.value) !== JSON.stringify(original.value)
				),
				loading: false,
				save: saveMock,
				reload: reloadMock,
			})
		},
	}
})

vi.mock('@/composables/useDirtyGuard', () => ({ useDirtyGuard: vi.fn() }))
vi.mock('@/utils', () => ({
	cleanError: (message: string) => String(message).replace(/<[^>]+>/g, ''),
	validateFile: vi.fn(),
}))
vi.mock('@/utils/safeUrl', () => ({ safeUrl: (url: string) => url }))

vi.stubGlobal('__', (text: string) => text)
;(String.prototype as any).format ??= function (...args: string[]) {
	return args.reduce((out, arg, i) => out.replace(`{${i}}`, arg), String(this))
}

import SettingsListPanel from '@/components/Layouts/settings/desktop/SettingsListPanel.vue'
import { badgesSettingsPage } from '@/components/Settings/Badges/badges'

const champion = {
	name: 'Champion',
	title: 'Champion',
	enabled: 1,
	description: 'Finished a course',
	image: '/files/champion.png',
	grant_only_once: 1,
	event: 'Value Change',
	reference_doctype: 'LMS Batch',
	condition: 'doc.status == "Complete"',
	user_field: 'owner',
	field_to_check: '',
}

const mountPage = () =>
	mount(SettingsListPanel, {
		props: { page: badgesSettingsPage, title: 'Badges' },
		global: { mocks: { __: (text: string) => text } },
	})

type Wrapper = ReturnType<typeof mountPage>

const openBadge = async (wrapper: Wrapper, name = 'Champion') => {
	await wrapper.find(`[data-testid="row-${name}"]`).trigger('click')
	await flushPromises()
	return wrapper
}

const openNew = async (wrapper: Wrapper) => {
	await wrapper.find('[data-testid="new"]').trigger('click')
	await flushPromises()
	return wrapper
}

// Either control: Description is a textarea and the rest are inputs. Both
// halves are scoped to the testid, because a bare `, textarea` would match any
// textarea on the page.
const control = (label: string) =>
	`[aria-label="${label}"] input, [aria-label="${label}"] textarea`

const field = (wrapper: Wrapper, testid: string) => wrapper.get(control(testid))

const valueOf = (wrapper: Wrapper, testid: string) =>
	(wrapper.get(control(testid)).element as HTMLInputElement).value

const save = (wrapper: Wrapper) =>
	wrapper.get('[data-testid="settings-fields-save"]').trigger('click')

beforeEach(() => {
	vi.clearAllMocks()
	rows.length = 0
	rows.push({ ...champion })
	saveMock.mockResolvedValue({ name: 'Champion' })
})

describe('the top of the badge form is editable', () => {
	it('takes what is typed into the Title', async () => {
		const wrapper = await openBadge(mountPage())

		await field(wrapper, 'Title').setValue('Course Champion')

		expect(valueOf(wrapper, 'Title')).toBe('Course Champion')
	})

	it('takes what is typed into the Description', async () => {
		const wrapper = await openBadge(mountPage())

		await field(wrapper, 'Description').setValue('Finished every lesson')

		expect(valueOf(wrapper, 'Description')).toBe('Finished every lesson')
	})

	// The bug was that neither said it was a field. Both are drawn by a control
	// that renders its own <label for>, so the box is named on screen and by a
	// screen reader alike.
	// The schema renderer names the box with `aria-label` and draws the wording
	// beside it, where the form this replaces passed FormControl its own `label`
	// and got a `<label for>`. Either way the control has an accessible name and
	// the wording is on screen.
	it('labels both of them on screen, and names the box', () => {
		const wrapper = mountPage()
		return openBadge(wrapper).then(() => {
			for (const text of ['Title', 'Description']) {
				expect(wrapper.find(`[aria-label="${text}"]`).exists()).toBe(true)
				expect(wrapper.text()).toContain(text)
			}
		})
	})

	// A control with its focus ring taken away and nothing put back is a control a
	// keyboard user cannot find (WCAG 2.4.7). The old masthead did exactly that,
	// on both boxes.
	it('leaves every field its focus indicator', async () => {
		const wrapper = await openBadge(mountPage())

		const html = wrapper.html()

		expect(html).not.toContain('focus:outline-none')
		expect(html).not.toContain('focus:ring-0')
	})

	it('marks both of them required, as LMS Badge does', async () => {
		const wrapper = await openBadge(mountPage())

		expect(
			wrapper.get('[aria-label="Title"]').attributes('data-required')
		).toBe('yes')
		expect(
			wrapper.get('[aria-label="Description"]').attributes('data-required')
		).toBe('yes')
	})

	it('uploads a new picture onto the badge', async () => {
		const wrapper = await openBadge(mountPage())

		await wrapper.get('[data-testid="uploaded"]').trigger('click')

		expect(wrapper.get('img').attributes('src')).toBe('/files/badge.png')
	})
})

describe('opening a badge', () => {
	it('fills every field from the record', async () => {
		const wrapper = await openBadge(mountPage())

		expect(valueOf(wrapper, 'Title')).toBe('Champion')
		expect(valueOf(wrapper, 'Description')).toBe('Finished a course')
		expect(
			wrapper.get('[aria-label="Assign For"]').attributes('data-value')
		).toBe('LMS Batch')
		expect(
			wrapper.get('[aria-label="Assign To"]').attributes('data-value')
		).toBe('owner')
		expect(wrapper.get('[aria-label="Event"]').attributes('data-value')).toBe(
			'Value Change'
		)
		expect(wrapper.get('[data-testid="code"]').attributes('data-value')).toBe(
			'doc.status == "Complete"'
		)
		expect(wrapper.get('img').attributes('src')).toBe('/files/champion.png')
	})

	it('titles the page with the badge it opened', async () => {
		const wrapper = await openBadge(mountPage())

		expect(wrapper.get('[data-title]').attributes('data-title')).toBe(
			'Champion'
		)
	})

	it('opens a new badge on the doctype defaults', async () => {
		const wrapper = await openNew(mountPage())

		expect(wrapper.get('[data-title]').attributes('data-title')).toBe(
			'New Badge'
		)
		expect(valueOf(wrapper, 'Title')).toBe('')
		expect(wrapper.get('[aria-label="Event"]').attributes('data-value')).toBe(
			'New'
		)
		expect(
			wrapper.get('[aria-label="Assign To"]').attributes('data-value')
		).toBe('member')
	})
})

describe('save is offered only for something to save', () => {
	it('disables Save on a badge nothing has been done to', async () => {
		const wrapper = await openBadge(mountPage())

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeDefined()
		expect(wrapper.find('[data-testid="badge-discard"]').exists()).toBe(false)
	})

	it('arms Save once a field changes, and still offers no Discard', async () => {
		const wrapper = await openBadge(mountPage())

		await field(wrapper, 'Title').setValue('Renamed')

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeUndefined()
		expect(wrapper.find('[data-testid="badge-discard"]').exists()).toBe(false)
	})

	it('disables Save on a new badge until something is typed', async () => {
		const wrapper = await openNew(mountPage())

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeDefined()

		await field(wrapper, 'Title').setValue('Champion II')

		expect(
			wrapper.get('[data-testid="settings-fields-save"]').attributes('disabled')
		).toBeUndefined()
	})

	// Save is the only header action a form has, on an existing badge and a new
	// one alike. Discarding is leaving: Back asks, and the unsaved badge in the
	// header is what says there is something to lose.
	it('offers Save and nothing else, dirty or not, new or not', async () => {
		for (const wrapper of [
			await openBadge(mountPage()),
			await openNew(mountPage()),
		]) {
			await field(wrapper, 'Title').setValue('Renamed')

			const actions = wrapper
				.findAll('[data-testid]')
				.map((node) => node.attributes('data-testid'))
				.filter((id) => id === 'settings-fields-save' || id === 'badge-discard')

			expect(actions).toEqual(['settings-fields-save'])
			expect(wrapper.text()).not.toContain('Discard')
		}
	})

	it('marks the header unsaved while there is an edit outstanding', async () => {
		const wrapper = await openBadge(mountPage())
		expect(wrapper.get('[data-unsaved]').attributes('data-unsaved')).toBe('no')

		await field(wrapper, 'Title').setValue('Renamed')

		expect(wrapper.get('[data-unsaved]').attributes('data-unsaved')).toBe('yes')
	})
})

describe('saving', () => {
	it('writes the record and goes back to the list', async () => {
		const wrapper = await openBadge(mountPage())

		await field(wrapper, 'Title').setValue('Renamed')
		await save(wrapper)
		await flushPromises()

		expect(saveMock).toHaveBeenCalled()
		expect(listReload).toHaveBeenCalled()
		expect(wrapper.find('[data-testid="list"]').exists()).toBe(true)
	})

	it('names the first missing field rather than sending an empty badge', async () => {
		const wrapper = await openNew(mountPage())

		await field(wrapper, 'Description').setValue('Won it')
		await save(wrapper)
		await flushPromises()

		expect(saveMock).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledWith('Title is required')
	})
})
