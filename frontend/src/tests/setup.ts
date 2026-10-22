import { format } from 'node:util'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { config, type VueWrapper } from '@vue/test-utils'

config.global.stubs = {
	...config.global.stubs,
	ScrollArea: {
		inheritAttrs: false,
		props: ['viewportClass'],
		template: '<div data-slot="scroll-area" v-bind="$attrs"><div data-slot="scroll-area-viewport" :class="viewportClass"><slot /></div></div>',
	},
}

// main.js puts `__` on window; without it a script-block translation dies on a
// bare ReferenceError. Mirrors translate(), including the contract that a
// message with {0} returns a { format } object rather than a string.
vi.stubGlobal('__', (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, index) =>
				args[Number(index)] === undefined ? match : String(args[Number(index)])
			),
	}
})

// face-api.js bundles TensorFlow, which under jsdom sees both a window and a
// process, registers a browser and then a node platform, and warns about the
// second. Nothing here runs a model; proctoringMonitor.test.ts mocks its own.
vi.mock('face-api.js', () => ({
	nets: { tinyFaceDetector: { loadFromUri: async () => {} } },
	detectAllFaces: async () => [],
	TinyFaceDetectorOptions: class {},
}))

// A test that prints is a test with a problem nobody is looking at: a Vue
// warning, a missing stub, a rejected promise caught and logged. Every console
// call is recorded instead of printed and fails the test that made it. A test
// that expects output spies on the method itself, which replaces this recorder
// for that test only.
//
// The allow-list is for output a test cannot fix. Each entry names its source;
// the app ones are bugs to fix, after which the entry goes.
const ALLOWED = [
	// reka-ui's dev check on frappe-ui's Dialog, which sets aria-describedby
	// even when it renders no DialogDescription.
	/^Warning: Missing `Description` or `aria-describedby="undefined"` for DialogContent\.$/,
	// App: EditorJS's built-in paragraph tool and the markdown tool both claim
	// pasted <p>, so markdown never receives one.
	/^Paste handler for «markdown» Tool on «P» tag is skipped because it is already used by «paragraph» Tool\.$/,
	// App: ProgrammingExerciseForm declares exerciseID required, and the
	// /programming-exercises/new route passes none.
	/^\[Vue warn\]: Missing required prop: "exerciseID"/,
	// App: ExerciseConsole's hint combo "Mod+`" should name the key, "Mod+Backtick".
	/^\[frappe-ui\] "`" in the combo "Mod\+`" is not a key name/,
	// App: NewCourseForm starts course.image as undefined, and Uploader's
	// modelValue takes a string or null.
	/^\[Vue warn\]: Invalid prop: type check failed for prop "modelValue"\. Expected String \| Null, got Undefined[\s\S]*<NewCourseForm/,
	// App: the /quiz-submissions/:quizID redirect names a route with no quizID
	// param, and the router drops the one it carries over.
	/^\[Vue Router warn\]: Discarded invalid param\(s\) "quizID" when navigating/,
]

const printed: string[] = []
for (const method of ['error', 'warn', 'log', 'info', 'debug'] as const) {
	console[method] = (...args: unknown[]) => {
		const line = format(...args)
		if (!ALLOWED.some((pattern) => pattern.test(line))) {
			printed.push(`console.${method}: ${line}`)
		}
	}
}

const assertSilent = (when: string) => {
	if (!printed.length) return
	const lines = printed.splice(0)
	throw new Error(`${when} printed to the console:\n${lines.join('\n')}`)
}

// Registered first so it runs last, after every cleanup hook below and in the
// test file has had its chance to warn.
afterEach(() => assertSilent('This test'))
beforeAll(() => assertSilent('Importing this file'))
afterAll(() => assertSilent('A hook in this file'))

afterEach(() => {
	vi.restoreAllMocks()
	vi.useRealTimers()
})

if (typeof window !== 'undefined') {
	const { config } = await import('@vue/test-utils')
	const { safeHtml, vExternal } = await import('../directives')

	// main.js registers these on the app, so a component that uses one renders
	// wrong under a bare mount() and the failure looks like missing data rather
	// than a missing directive. Registering them here keeps component tests
	// rendering what the app renders. Skipped under `@vitest-environment node`,
	// where nothing mounts and DOMPurify has no window to bind to.
	config.global.directives = {
		...config.global.directives,
		'safe-html': safeHtml,
		external: vExternal,
	}

	// Unmounts whatever a test left mounted. VTU's enableAutoUnmount cannot be
	// used here: it unmounts unconditionally, and a test that already unmounted
	// its wrapper would then make Vue warn about unmounting an unmounted app.
	const roots: VueWrapper[] = []
	config.plugins.VueWrapper.install((wrapper) => {
		if ((wrapper as unknown as { __app: unknown }).__app) roots.push(wrapper)
		return {}
	})

	// Globals a test replaces with Object.defineProperty or a plain assignment,
	// which vi.restoreAllMocks does not undo. Snapshotted after the file's own
	// module-level setup has run, so a file-wide polyfill survives.
	const STUBBED = [
		'innerWidth',
		'innerHeight',
		'matchMedia',
		'open',
		'requestAnimationFrame',
		'cancelAnimationFrame',
		'ResizeObserver',
		'IntersectionObserver',
	]
	let globals: Record<string, PropertyDescriptor | undefined> = {}
	let href = ''
	const attributes = (el: Element) =>
		Array.from(el.attributes, ({ name, value }) => [name, value] as const)
	let htmlAttributes: (readonly [string, string])[] = []
	let bodyAttributes: (readonly [string, string])[] = []

	beforeAll(() => {
		globals = Object.fromEntries(
			STUBBED.map((key) => [key, Object.getOwnPropertyDescriptor(window, key)])
		)
		href = window.location.href
		htmlAttributes = attributes(document.documentElement)
		bodyAttributes = attributes(document.body)
	})

	const restoreAttributes = (
		el: Element,
		saved: (readonly [string, string])[]
	) => {
		for (const { name } of Array.from(el.attributes)) el.removeAttribute(name)
		for (const [name, value] of saved) el.setAttribute(name, value)
	}

	afterEach(() => {
		for (const wrapper of roots.splice(0)) {
			if (!wrapper.vm?.$.isUnmounted) wrapper.unmount()
		}
		document.body.innerHTML = ''
		restoreAttributes(document.documentElement, htmlAttributes)
		restoreAttributes(document.body, bodyAttributes)
		localStorage.clear()
		sessionStorage.clear()
		if (window.location.href !== href)
			window.history.replaceState(null, '', href)
		for (const [key, descriptor] of Object.entries(globals)) {
			if (descriptor) Object.defineProperty(window, key, descriptor)
			else delete (window as unknown as Record<string, unknown>)[key]
		}
	})
}
