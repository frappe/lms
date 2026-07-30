/**
 * The assignment submission renders in an iframe — its own Vue app — so the
 * preview's provide/inject can't reach it. Student View has to travel in the
 * iframe URL, and the receiving page turns it back into a provide.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { calls } = vi.hoisted(() => ({ calls: { value: [] as any[] } }))

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
		return Promise.resolve('SUB-0001')
	},
	toast: {},
}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('@/components/AssessmentPlugin.vue', () => ({ default: {} }))
vi.mock('../translation', () => ({ default: {} }))
vi.mock('@/utils/basePath', () => ({
	getLmsRoute: (path: string) => `/lms/${path}`,
}))
vi.mock('lucide-vue-next', () => ({ Pencil: {} }))

const { Assignment } = await import('@/utils/assignment')
// Imported at module scope: '@/utils' pulls the whole editor toolchain and is
// too slow to load inside a test's timeout.
const { getEditorTools } = await import('@/utils')

function renderReadOnly(config: Record<string, unknown> | undefined) {
	const tool = new Assignment({
		data: { assignment: 'ASSIGN-1' },
		api: {},
		readOnly: true,
		config,
	})
	tool.wrapper = document.createElement('div')
	tool.renderAssignment('ASSIGN-1')
	return tool
}

async function iframeSrc(config: Record<string, unknown> | undefined) {
	const tool = renderReadOnly(config)
	// let the get_own_assignment_submission promise settle
	await new Promise((resolve) => setTimeout(resolve, 0))
	return tool.wrapper.querySelector('iframe')?.getAttribute('src') ?? ''
}

describe('assignment iframe URL', () => {
	beforeEach(() => {
		calls.value = []
		vi.stubGlobal('__', (s: string) => s)
	})

	it('marks the iframe as Student View when the tool config says so', async () => {
		const src = await iframeSrc({ studentView: true })

		expect(src).toContain('fromLesson=1')
		expect(src).toContain('studentView=1')
	})

	it('omits the flag for a normal lesson view', async () => {
		const src = await iframeSrc({ studentView: false })

		expect(src).toContain('fromLesson=1')
		expect(src).not.toContain('studentView')
	})

	it('omits the flag when no config is passed at all', async () => {
		const src = await iframeSrc(undefined)

		expect(src).not.toContain('studentView')
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
