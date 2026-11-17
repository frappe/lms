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

	it('unmounts the assignment when EditorJS destroys the block', async () => {
		const { tool } = await renderInLesson({ studentView: false })

		tool.destroy()

		expect(unmount).toHaveBeenCalledTimes(1)
	})
})
