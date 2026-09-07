/**
 * The dialog gives the editor a fixed box, so the question field absorbs what
 * the options leave or the slack shows as dead space. The fill covered
 * open-ended only, and never reached the field.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const editorClassFor = { current: [] as unknown[] }

vi.mock('frappe-ui', () => ({
	TextEditor: {
		props: ['editorClass', 'content', 'editable', 'fixedMenu', 'placeholder'],
		created() {
			// @ts-expect-error - options API `this` inside a stub
			editorClassFor.current = this.editorClass
		},
		template: '<div class="text-editor-stub" />',
	},
	Button: { template: '<button><slot /></button>' },
	Badge: { template: '<span><slot /></span>' },
	Dropdown: { template: '<div><slot /></div>' },
	FormControl: { template: '<input />' },
	FormLabel: { template: '<label />' },
}))

vi.stubGlobal('__', (s: string) => s)

// translation.js installs String.prototype.format at app boot; the marks label
// reads it during setup, so a bare mount() would fail on the format call rather
// than on anything this file is about.
// @ts-expect-error - augmenting the frappe global
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return args.reduce<string>(
		(out, arg, i) => out.replaceAll(`{${i}}`, String(arg)),
		this
	)
}

async function mountEditor(uiType: string, fillHeight: boolean) {
	const { default: QuestionEditor } = await import(
		'@/components/Quiz/QuestionEditor.vue'
	)
	return mount(QuestionEditor, {
		props: {
			question: { question: 'Q?', option_1: 'a', option_2: 'b' },
			uiType,
			fillHeight,
			idPrefix: 'test',
		},
		global: { config: { globalProperties: { __: (s: string) => s } as any } },
	})
}

const classOf = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('.text-editor-stub').classes().join(' ')

const editorClass = () => (editorClassFor.current as string[]).join(' ')

describe('QuestionEditor fill', () => {
	it('fills for an open ended question', async () => {
		const wrapper = await mountEditor('open_ended', true)
		expect(classOf(wrapper)).toContain('flex-1')
		expect(editorClass()).toContain('flex-1')
	})

	it('fills for a choices question too', async () => {
		const wrapper = await mountEditor('single', true)
		expect(classOf(wrapper)).toContain('flex-1')
		expect(editorClass()).toContain('flex-1')
	})

	it('keeps a floor so many options cannot squeeze it to nothing', async () => {
		await mountEditor('single', true)
		expect(editorClass()).toContain('flex-1')
		expect(editorClass()).toMatch(/min-h-\[\d/)
	})

	// A ten-option question needs more room than the dialog has. `min-h-0` let
	// every ancestor shrink to nothing while the field kept its floor, so the
	// toolbar rendered on top of the options.
	it('never lets an ancestor shrink below the field it wraps', async () => {
		const wrapper = await mountEditor('single', true)
		expect(classOf(wrapper)).toContain('flex-1')
		expect(classOf(wrapper)).not.toContain('min-h-0')
	})

	it('takes its natural height when the owner gives no height to fill', async () => {
		const wrapper = await mountEditor('single', false)
		expect(classOf(wrapper)).not.toContain('flex-1')
		expect(editorClass()).toContain('min-h-[5rem]')
	})
})
