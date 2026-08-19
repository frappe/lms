/**
 * The programming-exercise submission renders in an iframe (its own Vue app),
 * so the preview's provide/inject can't reach it. Student View has to travel in
 * the iframe URL, exactly as it does for assignments; without this the preview
 * kept showing the moderator-only settings button.
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
vi.mock('@/utils/basePath', () => ({
	getLmsRoute: (path: string) => `/lms/${path}`,
}))
vi.mock('lucide-vue-next', () => ({ Code: {} }))

const { Program } = await import('@/utils/program')
// Imported at module scope: '@/utils' pulls the whole editor toolchain.
const { getEditorTools } = await import('@/utils')

async function iframeSrc(config: Record<string, unknown> | undefined) {
	const tool = new Program({
		data: { exercise: 'EX-1' },
		api: {},
		readOnly: true,
		config,
	} as any) as any
	tool.wrapper = document.createElement('div')
	tool.renderExercise('EX-1')
	// let the get_value promise settle
	await new Promise((resolve) => setTimeout(resolve, 0))
	return tool.wrapper.querySelector('iframe')?.getAttribute('src') ?? ''
}

describe('programming-exercise iframe URL', () => {
	beforeEach(() => {
		calls.value = []
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
		expect(await iframeSrc(undefined)).not.toContain('studentView')
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
