/**
 * SetupPreview.vue: the app as it is being set up, beside the setup questions.
 * The page and card components are stubbed so the test reads what the preview
 * hands them for each answer.
 */
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

const passthrough = (name: string, props: string[] = []) =>
	defineComponent({
		name,
		props,
		setup:
			(_props, { slots }) =>
			() =>
				h('div', { 'data-stub': name }, slots.default?.()),
	})

vi.mock('frappe-ui', () => ({
	Badge: passthrough('Badge', ['label']),
	Button: defineComponent({
		name: 'Button',
		setup:
			(_props, { slots, attrs }) =>
			() =>
				h('button', { class: attrs.class }, slots.default?.()),
	}),
	ItemListRow: passthrough('ItemListRow', ['active']),
	Popover: defineComponent({
		name: 'Popover',
		props: ['open'],
		setup:
			(props, { slots }) =>
			() =>
				h('div', [slots.trigger?.(), props.open ? slots.default?.() : null]),
	}),
	FormControl: passthrough('FormControl', ['placeholder', 'type']),
	Sidebar: passthrough('Sidebar', ['collapsed', 'ariaLabel']),
	SidebarHeader: passthrough('SidebarHeader', ['title', 'subtitle']),
	SidebarItem: passthrough('SidebarItem', ['label', 'icon', 'active']),
	TabButtons: passthrough('TabButtons', ['options', 'modelValue']),
}))
vi.mock('@framework/ui/components/SetupFlow/index', () => ({
	SetupPreviewLogin: passthrough('SetupPreviewLogin', [
		'email',
		'passwordLength',
		'emailLink',
		'labels',
	]),
	SetupPreviewSwap: passthrough('SetupPreviewSwap'),
}))
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: defineComponent({
		name: 'ListPage',
		props: [
			'title',
			'rows',
			'breadcrumbs',
			'totalCount',
			'loading',
			'emptyName',
			'emptyIcon',
		],
		setup:
			(props, { slots }) =>
			() =>
				h('div', [
					slots.actions?.(),
					slots.filters?.(),
					...props.rows.map((row: object) => slots.card?.({ row })),
				]),
	}),
}))
vi.mock('@/components/CourseCard.vue', () => ({
	default: passthrough('CourseCard', ['course']),
}))
vi.mock('@/pages/Batches/components/BatchCard.vue', () => ({
	default: passthrough('BatchCard', ['batch']),
}))
vi.mock('@/components/Controls/ToggleFilter.vue', () => ({
	default: passthrough('ToggleFilter', ['modelValue', 'label', 'mobileLabel']),
}))
vi.mock('@/utils', () => ({
	convertToTitleCase: (text: string) => text,
	getSidebarLinks: () => [
		{ label: 'General', items: [{ label: 'Home', icon: 'Home', to: 'Home' }] },
		{
			label: 'Learning',
			items: [
				{ label: 'Courses', icon: 'BookOpen', to: 'Courses' },
				{ label: 'Batches', icon: 'Users', to: 'Batches' },
			],
		},
	],
}))

async function preview(props: Record<string, unknown>) {
	const { default: SetupPreview } =
		await import('@/components/Setup/SetupPreview.vue')
	return mount(SetupPreview, {
		props: { step: { type: 'tags' }, answers: {}, ...props },
		global: {
			stubs: { LMSLogo: true, SidebarCollapseButton: true },
			mocks: { __: (text: string) => text },
		},
	})
}

const courses = (wrapper: Awaited<ReturnType<typeof preview>>) =>
	wrapper
		.findAllComponents({ name: 'CourseCard' })
		.map((card) => card.props('course'))
const activeLink = (wrapper: Awaited<ReturnType<typeof preview>>) =>
	wrapper
		.findAllComponents({ name: 'SidebarItem' })
		.filter((item) => item.props('active'))
		.map((item) => item.props('label'))

describe('SetupPreview', () => {
	it('shows the sign-in page, with only the typed length, on the password step', async () => {
		const wrapper = await preview({
			step: { type: 'password' },
			email: 'owner@example.com',
			passwordLength: 5,
		})
		const login = wrapper.findComponent({ name: 'SetupPreviewLogin' })

		expect(login.props('email')).toBe('owner@example.com')
		expect(login.props('passwordLength')).toBe(5)
		expect(login.props('emailLink')).toBe(false)
		expect(wrapper.findComponent({ name: 'Sidebar' }).exists()).toBe(false)
	})

	it('opens the sidebar the way the app does, with the owner under the app name', async () => {
		const wrapper = await preview({ userName: 'Trial Owner' })

		expect(wrapper.findComponent({ name: 'Sidebar' }).props('collapsed')).toBe(false)
		expect(wrapper.findComponent({ name: 'SidebarHeader' }).props()).toMatchObject({
			title: 'Learning',
			subtitle: 'Trial Owner',
		})
	})

	it('lists the demo course alone before any answer, then courses for the use case', async () => {
		const fresh = await preview({})
		expect(courses(fresh).map((c) => c.title)).toEqual([
			'A guide to Frappe Learning',
		])
		expect(courses(fresh)[0].image).toBe('/assets/lms/images/course_card.jpeg')
		expect(activeLink(fresh)).toEqual(['Courses'])

		const coaching = await preview({
			answers: { usage_context: 'Coaching or Training Institute' },
		})
		expect(courses(coaching).map((c) => c.title)).toEqual(['JEE Physics crash course'])
		// Its own cover, so the change is plain to see; only the demo course has the image.
		expect(courses(coaching)[0]).toMatchObject({ card_gradient: 'Orange' })
		expect(courses(coaching)[0].image).toBeUndefined()
	})

	it('prices every course for a paid launch and keeps only certified ones for a certificate', async () => {
		const usage_context = 'School'
		const paid = await preview({
			answers: { usage_context, first_milestone: 'Launch a paid course' },
		})
		expect(courses(paid).every((c) => c.paid_course === 1 && c.price)).toBe(
			true,
		)

		const certificate = await preview({
			answers: { usage_context, first_milestone: 'Award my first certificate' },
		})
		expect(courses(certificate).map((c) => c.title)).toEqual([
			'Grade 8 Science',
		])
		expect(
			certificate.findComponent({ name: 'ToggleFilter' }).props('modelValue'),
		).toBe(true)
	})

	it('opens Batches for onboarding learners', async () => {
		const wrapper = await preview({
			answers: {
				usage_context: 'School',
				first_milestone: 'Onboard my existing learners',
			},
		})

		expect(activeLink(wrapper)).toEqual(['Batches'])
		expect(
			wrapper.findComponent({ name: 'BatchCard' }).props('batch').title,
		).toBe('Young Scientists Lab')
	})

	it('shows invited teachers, named from their email, as the first course’s instructors and counts invited students as enrolled', async () => {
		const wrapper = await preview({
			answers: { usage_context: 'School' },
			invitees: [
				{ email: 'asha.pillai@example.com', role: 'Course Creator' },
				{ email: 'ravi@example.com', role: 'Moderator' },
				{ email: 'meena@example.com', role: 'LMS Student' },
				{ email: 'kiran@example.com', role: 'Batch Evaluator' },
			],
		})

		// Two instructors show by first name ("Asha and Ravi"), so both names must be set.
		expect(courses(wrapper)[0].instructors).toEqual([
			{ name: 'asha.pillai@example.com', full_name: 'Asha Pillai', first_name: 'Asha' },
			{ name: 'ravi@example.com', full_name: 'Ravi', first_name: 'Ravi' },
		])
		expect(courses(wrapper)[0].enrollments).toBe(49)
	})

	it('shows the invited staff, evaluators too, on the batch card and seats the invited students', async () => {
		const wrapper = await preview({
			answers: { usage_context: 'School', first_milestone: 'Onboard my existing learners' },
			invitees: [
				{ email: 'raiza@example.com', role: 'Batch Evaluator' },
				{ email: 'meena@example.com', role: 'LMS Student' },
			],
		})
		const batch = wrapper.findComponent({ name: 'BatchCard' }).props('batch')

		expect(batch.instructors).toEqual([
			{ name: 'raiza@example.com', full_name: 'Raiza', first_name: 'Raiza' },
		])
		expect(batch.seats_left).toBe(19)
	})

	it('swaps the samples for the site’s own rows the owner is about to land on', async () => {
		const demoBatch = { name: 'demo', title: 'Course Builders Cohort' }
		const wrapper = await preview({
			answers: { usage_context: 'School', first_milestone: 'Launch a paid course' },
			landing: { view: 'Batches', rows: [demoBatch] },
		})

		expect(activeLink(wrapper)).toEqual(['Batches'])
		expect(wrapper.findComponent({ name: 'BatchCard' }).props('batch')).toEqual(demoBatch)
		expect(courses(wrapper)).toEqual([])
	})

	it('marks the made-up cards as examples, not the demo course or the site’s own rows', async () => {
		const badges = (wrapper: Awaited<ReturnType<typeof preview>>) =>
			wrapper.findAllComponents({ name: 'Badge' }).map((b) => b.props('label'))

		expect(badges(await preview({}))).toEqual([])
		expect(badges(await preview({ answers: { usage_context: 'School' } }))).toEqual([
			'Example',
		])
		const landed = await preview({
			answers: { usage_context: 'School' },
			landing: { view: 'Courses', rows: [{ name: 'demo', title: 'A guide to Frappe Learning' }] },
		})
		expect(badges(landed)).toEqual([])
	})

	it('opens the Import menu on the tool question and points at where the pick starts', async () => {
		const step = { name: 'current_tool', type: 'tags' }
		const menu = (wrapper: Awaited<ReturnType<typeof preview>>) =>
			wrapper
				.findAllComponents({ name: 'ItemListRow' })
				.map((row) => [row.text(), row.props('active')])
		const ringed = (wrapper: Awaited<ReturnType<typeof preview>>) =>
			wrapper
				.findAll('button')
				.filter((button) => button.classes('ring-2'))
				.map((button) => button.text())

		const asked = await preview({ step })
		// The menu opens after the lit button is pressed, so it reads as a click.
		expect(menu(asked)).toEqual([])
		await new Promise((resolve) => setTimeout(resolve, 700))
		expect(menu(asked)).toEqual([
			['Import from a spreadsheet', false],
			['Import via ZIP', false],
		])
		expect(ringed(asked)).toEqual(['Import'])

		const sheets = await preview({ step, answers: { current_tool: 'Notion' } })
		await new Promise((resolve) => setTimeout(resolve, 700))
		expect(menu(sheets)[0]).toEqual(['Import from a spreadsheet', true])

		const scratch = await preview({ step, answers: { current_tool: 'No LMS yet' } })
		await new Promise((resolve) => setTimeout(resolve, 700))
		expect(menu(scratch)).toEqual([])
		expect(ringed(scratch)).toEqual(['New Course'])

		expect(menu(await preview({ answers: { current_tool: 'Moodle' } }))).toEqual([])
	})

	it('highlights the instructor row when an invited person joins the card, not for a student', async () => {
		const wrapper = await preview({ answers: { usage_context: 'School' }, invitees: [] })
		const highlighted = async () => {
			// The preview waits a frame before adding the class; wait one more.
			for (let frame = 0; frame < 2; frame++)
				await new Promise((resolve) => requestAnimationFrame(resolve))
			await nextTick()
			return wrapper.find('.staff-updated').exists()
		}

		await wrapper.setProps({ invitees: [{ email: 'meena@example.com', role: 'LMS Student' }] })
		expect(await highlighted()).toBe(false)

		await wrapper.setProps({
			invitees: [{ email: 'asha.pillai@example.com', role: 'Course Creator' }],
		})
		expect(await highlighted()).toBe(true)
	})
})
