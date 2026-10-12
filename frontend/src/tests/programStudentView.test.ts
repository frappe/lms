// Guards Student View reaching the lesson's exercise. Came in #2613 via the
// iframe URL; this branch's inline exercise mounts it through AssessmentBlock.
// Reworked on feat/assessment-visual-redesign to check props and unmount.
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { calls, mountBlock, unmount } = vi.hoisted(() => {
	const unmount = vi.fn()
	return {
		calls: { value: [] as any[] },
		unmount,
		mountBlock: vi.fn(() => ({ unmount })),
	}
})

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string): string => text
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

vi.mock('frappe-ui', () => ({
	call: (method: string, args: any) => {
		calls.value.push({ method, args })
		return Promise.resolve({ name: 'SUB-0001' })
	},
	toast: {},
}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: { data: { name: 'me@example.com' } } }),
}))
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('../translation', () => ({ default: {} }))
vi.mock('@/translation', () => ({ default: {} }))
vi.mock('@/components/Modals/ProgrammingExerciseModal.vue', () => ({
	default: {},
}))
vi.mock('@/components/Assessment/AssessmentBlock.vue', () => ({
	default: { name: 'AssessmentBlock' },
}))
vi.mock(
	'@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue',
	() => ({ default: { name: 'ProgrammingExerciseSubmission' } })
)
vi.mock('@/utils/blockMount', () => ({ mountBlock }))
vi.mock('lucide-vue-next', () => ({ Code: {} }))

const { Program } = await import('@/utils/program')
// Imported at module scope: '@/utils' pulls the whole editor toolchain.
const { getEditorTools } = await import('@/utils')

async function renderInLesson(config: Record<string, unknown> | undefined) {
	const tool = new Program({
		data: { exercise: 'EX-1' },
		api: {},
		readOnly: true,
		config,
	} as any) as any
	const wrapper = tool.render()
	// let the submission lookup settle
	await new Promise((resolve) => setTimeout(resolve, 0))
	return { tool, wrapper }
}

const mountedWith = () => {
	const [el, component, props] = mountBlock.mock.calls.at(-1) as any
	return { el, component, props }
}

describe('the programming exercise block in a lesson', () => {
	beforeEach(() => {
		calls.value = []
		mountBlock.mockClear()
		unmount.mockClear()
	})

	it('mounts inline, with no iframe', async () => {
		const { wrapper } = await renderInLesson({ studentView: false })

		expect(wrapper.querySelector('iframe')).toBeNull()
		const { el, component } = mountedWith()
		expect(el).toBe(wrapper)
		expect(component.name).toBe('AssessmentBlock')
	})

	it("hands the exercise the learner's own submission", async () => {
		await renderInLesson({ studentView: false })

		const { props } = mountedWith()
		expect(props.is.name).toBe('ProgrammingExerciseSubmission')
		expect(props.props).toEqual({
			exerciseID: 'EX-1',
			submissionID: 'SUB-0001',
			studentView: false,
		})
	})

	it('passes Student View through when the tool config says so', async () => {
		await renderInLesson({ studentView: true })

		const { props } = mountedWith()
		expect(props.studentView).toBe(true)
		expect(props.props.studentView).toBe(true)
	})

	it('defaults Student View off when no config is passed at all', async () => {
		await renderInLesson(undefined)

		expect(mountedWith().props.studentView).toBe(false)
	})

	it('unmounts the exercise when EditorJS destroys the block', async () => {
		const { tool } = await renderInLesson({ studentView: false })

		tool.destroy()

		expect(unmount).toHaveBeenCalledTimes(1)
	})
})

describe('getEditorTools wiring', () => {
	it('hands the programming-exercise tool the Student View flag', () => {
		const tools = getEditorTools(false, {}, { studentView: true }) as Record<
			string,
			any
		>

		expect(tools.program.config.studentView).toBe(true)
	})

	it('defaults the flag off', () => {
		const tools = getEditorTools() as Record<string, any>

		expect(tools.program.config.studentView).toBe(false)
	})
})
