/**
 * Tests for PersonaCard.vue: the data-driven onboarding stepper.
 *
 * PersonaCard knows nothing about the persona questions; it renders whatever
 * `steps` it is given and steps through them. These tests pin the stepper
 * contract: auto-advance on select, Back/Next navigation with answers kept,
 * the single `complete` handoff when the outcome step is reached, and `choose`
 * on an outcome row.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import PersonaCard from '@/components/Persona/PersonaCard.vue'

// frappe-ui's internal module resolution doesn't work under vitest; stub the
// Button (used for Next, Back, and the tag chips) so it renders a real,
// clickable, disable-able button with all its slots.
vi.mock('frappe-ui', () => ({
	Button: {
		name: 'Button',
		props: ['disabled'],
		emits: ['click'],
		setup(props: any, { slots, emit }: any) {
			return () =>
				h(
					'button',
					{
						disabled: props.disabled,
						onClick: () => !props.disabled && emit('click'),
					},
					[
						slots.prefix?.(),
						slots.icon?.(),
						slots.default?.(),
						slots.suffix?.(),
					]
				)
		},
	},
	FormControl: {
		name: 'FormControl',
		props: ['modelValue', 'placeholder', 'type'],
		emits: ['update:modelValue'],
		setup(props: any, { emit }: any) {
			return () =>
				h('textarea', {
					value: props.modelValue,
					placeholder: props.placeholder,
					onInput: (e: any) => emit('update:modelValue', e.target.value),
				})
		},
	},
}))

// A trivial icon component for the outcome fixture (avoids Lucide resolution).
const Dot = { name: 'Dot', render: () => h('span', 'o') }

const steps = [
	{
		key: 'usage_context',
		type: 'tags',
		title: 'Where will you be using Frappe Learning?',
		subtitle: 'hint',
		options: [
			{ label: 'School', value: 'School' },
			{ label: 'Company', value: 'Company' },
		],
	},
	{
		key: 'current_tool',
		type: 'tags',
		title: 'What are you using today?',
		subtitle: 'hint',
		options: [
			{ label: 'Moodle', value: 'Moodle', icon: 'moodle' },
			{ label: 'Notion', value: 'Notion', icon: 'notion' },
		],
	},
	{
		key: 'first_milestone',
		type: 'outcome',
		title: 'Your workspace is ready',
		subtitle: 'Where do you want to start?',
		options: [
			{ label: 'Publish a course', value: 'Publish', icon: Dot },
			{ label: 'Just exploring', value: 'Explore', icon: Dot },
		],
	},
]

const stubs = {
	LucideChevronLeft: true,
	LucideChevronRight: true,
	LucideX: true,
	LMSLogo: true,
}

function mountCard() {
	return mount(PersonaCard, { props: { steps }, global: { stubs } })
}

// Find a native <button> whose text contains `label`.
function tag(wrapper: any, label: string) {
	return wrapper.findAll('button').find((b: any) => b.text().includes(label))
}

// The Next button (every Button renders as a plain <button> via the mock).
function nextBtn(wrapper: any) {
	return wrapper.findAll('button').find((b: any) => b.text().trim() === 'Next')
}

beforeEach(() => {
	;(window as any).__ = (s: string) => s
})

describe('PersonaCard', () => {
	it('renders the first step and its options', () => {
		const wrapper = mountCard()
		expect(wrapper.text()).toContain('Where will you be using Frappe Learning?')
		expect(tag(wrapper, 'School')).toBeTruthy()
		expect(tag(wrapper, 'Company')).toBeTruthy()
		// No back chevron on the first step.
		expect(wrapper.find('[aria-label="Back"]').exists()).toBe(false)
	})

	it('auto-advances to the next step when an option is selected', async () => {
		const wrapper = mountCard()
		await tag(wrapper, 'School')!.trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('What are you using today?')
	})

	it('keeps the answer when going Back and re-advances with Next', async () => {
		const wrapper = mountCard()
		await tag(wrapper, 'School')!.trigger('click')
		await flushPromises()
		// Back to step 1
		await wrapper.find('[aria-label="Back"]').trigger('click')
		await flushPromises()
		const school = tag(wrapper, 'School')!
		expect(school.attributes('aria-pressed')).toBe('true')
		// Next button is enabled because the step is answered; it re-advances.
		await nextBtn(wrapper)!.trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('What are you using today?')
	})

	it('emits complete once with the tag answers on reaching the outcome', async () => {
		const wrapper = mountCard()
		await tag(wrapper, 'School')!.trigger('click')
		await flushPromises()
		await tag(wrapper, 'Notion')!.trigger('click')
		await flushPromises()

		expect(wrapper.text()).toContain('Your workspace is ready')
		const complete = wrapper.emitted('complete')
		expect(complete).toHaveLength(1)
		expect(complete![0][0]).toEqual({
			usage_context: 'School',
			current_tool: 'Notion',
		})
		// Outcome step shows no Next button.
		expect(nextBtn(wrapper)).toBeUndefined()
	})

	it('emits choose with the step and option when an outcome row is clicked', async () => {
		const wrapper = mountCard()
		await tag(wrapper, 'School')!.trigger('click')
		await flushPromises()
		await tag(wrapper, 'Notion')!.trigger('click')
		await flushPromises()

		await tag(wrapper, 'Just exploring')!.trigger('click')
		const choose = wrapper.emitted('choose')
		expect(choose).toHaveLength(1)
		expect(choose![0][0]).toMatchObject({ key: 'first_milestone' })
		expect(choose![0][1]).toMatchObject({ value: 'Explore' })
	})

	it('supports a text step: Next disables until typed, value lands in complete', async () => {
		const textSteps = [
			{
				key: 'discovery',
				type: 'text',
				title: 'How did you hear about us?',
				subtitle: 'hint',
				placeholder: 'I heard from the community',
			},
			steps[2],
		]
		const wrapper = mount(PersonaCard, {
			props: { steps: textSteps },
			global: { stubs },
		})
		// Untyped: Next is disabled.
		expect(nextBtn(wrapper)!.attributes('disabled')).toBeDefined()
		await wrapper.find('textarea').setValue('a friend told me')
		expect(nextBtn(wrapper)!.attributes('disabled')).toBeUndefined()
		await nextBtn(wrapper)!.trigger('click')
		await flushPromises()
		expect(wrapper.emitted('complete')![0][0]).toEqual({
			discovery: 'a friend told me',
		})
	})

	it('re-emits complete with fresh answers after going back and editing', async () => {
		const wrapper = mountCard()
		await tag(wrapper, 'School')!.trigger('click')
		await flushPromises()
		await tag(wrapper, 'Notion')!.trigger('click')
		await flushPromises()
		// Back to the tool step, change the answer, return to the outcome.
		await wrapper.find('[aria-label="Back"]').trigger('click')
		await flushPromises()
		await tag(wrapper, 'Moodle')!.trigger('click')
		await flushPromises()
		const complete = wrapper.emitted('complete')
		expect(complete).toHaveLength(2)
		// The edit made after Back is what gets submitted, never stale.
		expect(complete![1][0]).toEqual({
			usage_context: 'School',
			current_tool: 'Moodle',
		})
	})
})
