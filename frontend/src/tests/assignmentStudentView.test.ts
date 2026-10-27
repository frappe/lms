import { describe, expect, it, vi, beforeEach } from 'vitest'

const { calls, mountBlock, unmount, lookup } = vi.hoisted(() => {
	const unmount = vi.fn()
	return {
		calls: { value: [] as { method: string; args: unknown }[] },
		unmount,
		mountBlock: vi.fn(() => ({ unmount })),
		lookup: { value: 'SUB-0001' as string | null },
	}
})

window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

vi.mock('frappe-ui', () => ({
	call: (method: string, args: unknown) => {
		calls.value.push({ method, args })
		return Promise.resolve(lookup.value)
	},
	toast: {},
}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('@/components/AssessmentPlugin.vue', () => ({ default: {} }))
vi.mock('@/components/Assessment/AssessmentBlock.vue', () => ({
	default: { name: 'AssessmentBlock' },
}))
vi.mock('@/components/Assignment.vue', () => ({
	default: { name: 'Assignment' },
}))
vi.mock('@/utils/blockMount', () => ({ mountBlock }))
vi.mock('../translation', () => ({ default: {} }))
vi.mock('lucide-vue-next', () => ({ Pencil: {} }))

const { Assignment } = await import('@/utils/assignment')
// Imported at module scope: '@/utils' pulls the whole editor toolchain and is
// too slow to load inside a test's timeout.
const { getEditorTools } = await import('@/utils')

async function renderInLesson(config: Record<string, unknown> | undefined) {
	const tool = new Assignment({
		data: { assignment: 'ASSIGN-1' },
		readOnly: true,
		config,
	})
	const wrapper = tool.render()
	// let the get_own_assignment_submission promise settle
	await new Promise((resolve) => setTimeout(resolve, 0))
	return { tool, wrapper }
}

const mountedWith = () => {
	const [el, component, props] = mountBlock.mock.calls.at(-1) as unknown as [
		HTMLElement,
		{ name: string },
		{
			is: { name: string }
			props: Record<string, unknown>
			studentView: boolean
		}
	]
	return { el, component, props }
}

// Guards the inline assignment block: props, Student View, and teardown.
// Student View came with #2613; the inline mount with this branch's assignment.
// Added on feat/assessment-visual-redesign to replace the iframe URL tests.
describe('the assignment block in a lesson', () => {
	beforeEach(() => {
		calls.value = []
		lookup.value = 'SUB-0001'
		mountBlock.mockClear()
		unmount.mockClear()
	})

	it('mounts inline, with no iframe and no fixed height', async () => {
		const { wrapper } = await renderInLesson({ studentView: false })

		expect(wrapper.querySelector('iframe')).toBeNull()
		expect(wrapper.className).not.toMatch(/(^|\s)h-/)
		const { el, component } = mountedWith()
		expect(el).toBe(wrapper)
		expect(component.name).toBe('AssessmentBlock')
	})

	it("hands the assignment the learner's own submission", async () => {
		await renderInLesson({ studentView: false })

		const { props } = mountedWith()
		expect(props.is.name).toBe('Assignment')
		expect(props.props).toEqual({
			assignmentID: 'ASSIGN-1',
			submissionName: 'SUB-0001',
			showTitle: false,
		})
	})

	it('starts a new submission when the learner has none', async () => {
		lookup.value = null
		await renderInLesson({ studentView: false })

		expect(mountedWith().props.props.submissionName).toBe('new')
	})

	// Guards a block destroyed mid-lookup mounting an app nobody unmounts.
	// Came with this branch's inline lesson assignment change.
	// Added on feat/assessment-visual-redesign to pin the destroyed-flag check.
	it('mounts nothing once the block is destroyed mid-lookup', async () => {
		const tool = new Assignment({
			data: { assignment: 'ASSIGN-1' },
			readOnly: true,
		})
		tool.render()
		tool.destroy()
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(mountBlock).not.toHaveBeenCalled()
	})

	it('passes Student View through when the tool config says so', async () => {
		await renderInLesson({ studentView: true })

		expect(mountedWith().props.studentView).toBe(true)
	})

	it('defaults Student View off when no config is passed at all', async () => {
		await renderInLesson(undefined)

		expect(mountedWith().props.studentView).toBe(false)
	})

	it('unmounts the assignment when EditorJS destroys the block', async () => {
		const { tool } = await renderInLesson({ studentView: false })

		tool.destroy()

		expect(unmount).toHaveBeenCalledTimes(1)
	})
})

describe('getEditorTools wiring', () => {
	it('hands the assignment tool the Student View flag', () => {
		const tools = getEditorTools(false, {}, { studentView: true }) as Record<
			string,
			any
		>

		expect(tools.assignment.config.studentView).toBe(true)
	})

	it('defaults the flag off', () => {
		const tools = getEditorTools() as Record<string, any>

		expect(tools.assignment.config.studentView).toBe(false)
	})
})
