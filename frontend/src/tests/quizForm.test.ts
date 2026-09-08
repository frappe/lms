/** QuizForm.vue, the quiz-authoring page once the question set became local. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { effectScope, reactive, watch } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// frappe's translation layer patches String.prototype.format onto the page at runtime.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

// jsdom ships no matchMedia and the shared setup adds none, so vueuse's useBreakpoints reports every query false and anything gated on a breakpoint is inert while its tests still pass.
let viewportWidth = 1280
window.matchMedia = ((query: string) => {
	const min = Number(/min-width:\s*(\d+(?:\.\d+)?)px/.exec(query)?.[1] ?? 0)
	return {
		matches: viewportWidth >= min,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	}
}) as unknown as typeof window.matchMedia

enableAutoUnmount(afterEach)

type Doc = Record<string, any>

// The record the "server" hands back on the mount fetch.
const server: { doc: Doc } = { doc: {} }
const clone = (value: Doc) => JSON.parse(JSON.stringify(value))

const META_URL = 'lms.lms.doctype.lms_quiz.lms_quiz.get_question_meta'

const {
	createResourceMock,
	createDocumentResourceMock,
	calls,
	bankAddSelected,
	bankSelection,
	bankPicks,
} = vi.hoisted(() => ({
	createResourceMock: vi.fn(),
	createDocumentResourceMock: vi.fn(),
	calls: {
		inserts: [] as any[],
		deletes: [] as any[],
		urls: [] as string[],
		hold: null as Promise<void> | null,
	},
	// A spy on the exposed method, so a test can still assert it was reached exactly once.
	bankAddSelected: vi.fn(),
	// The panel's internal selection, and the rows it would hand up for it.
	bankSelection: { count: 0 },
	bankPicks: { value: [] as any[] },
}))

// The live document resource, so setValue can do to it what frappe-ui's does.
let docResource: any = null

// documentResource's setValue.onSuccess does `out.doc = transform(data)`: the saved copy replaces the whole doc.
const savedSetValue = async (params: any, options: any) => {
	const saved = clone(params)
	server.doc = clone(saved)
	if (docResource) {
		docResource.doc = clone(saved)
		docResource.originalDoc = clone(saved)
	}
	options?.onSuccess?.(clone(saved))
	return clone(saved)
}
// setValue.onError does `out.doc = JSON.parse(out.previousDoc)`: the doc is
// REPLACED. A mock that leaves doc alone cannot see anything watching doc, so
// the guard below would pass without one.
const failedSetValue = async (params: any, options: any, error: any) => {
	const previousDoc = JSON.stringify(docResource?.doc ?? null)
	if (docResource) docResource.doc = JSON.parse(previousDoc)
	options?.onError?.(error)
	return clone(params)
}

const setValueSubmit = vi.fn(savedSetValue)
const deleteSubmit = vi.fn().mockResolvedValue({})
const reloadSpy = vi.fn()

// Every submitted url is recorded, so a test can assert that a question-set change reached the server through nothing at all, not just that it skipped the two endpoints this file happens to know the names of.
createResourceMock.mockImplementation((options: any) => ({
	options,
	data: null,
	fetch: vi.fn(),
	reload: vi.fn(),
	submit: vi.fn(async (params: any) => {
		calls.urls.push(options.url)
		if (options.url === 'frappe.client.delete') calls.deletes.push(params)
		if (options.url === 'frappe.client.insert') {
			calls.inserts.push(params)
			const name = `NEW-${calls.inserts.length}`
			// `hold` lets a test freeze the round trip and read `persisting` while it is genuinely in flight.
			if (calls.hold) await calls.hold
			return { name }
		}
		return {}
	}),
}))

// Mirrors documentResource.js: reload replaces doc AND originalDoc with the server copy, and isDirty is a deep watch between the two.
createDocumentResourceMock.mockImplementation((options: any) => {
	// documentResource.js:15 returns undefined without a doctype AND a name, so a
	// page that has not created its document yet holds nothing at all.
	if (!(options.doctype && options.name)) return undefined
	const resource = reactive({
		options,
		doctype: options.doctype,
		name: options.name,
		doc: null as Doc | null,
		originalDoc: null as Doc | null,
		isDirty: false,
		loading: false,
		reload: vi.fn(() => {
			reloadSpy()
			resource.doc = clone(server.doc)
			resource.originalDoc = clone(server.doc)
			return Promise.resolve(resource.doc)
		}),
		setValue: { submit: setValueSubmit },
		delete: { submit: deleteSubmit },
	})
	effectScope(true).run(() => {
		// Both sides, because isDirty is a comparison of the two: a save that leaves doc alone and refreshes originalDoc has to clear the flag, and watching doc alone would leave it stuck on.
		watch(
			[() => resource.doc, () => resource.originalDoc],
			() => {
				resource.isDirty =
					JSON.stringify(resource.doc) !== JSON.stringify(resource.originalDoc)
			},
			{ deep: true }
		)
	})
	docResource = resource
	return resource
})

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	createDocumentResource: createDocumentResourceMock,
	usePageMeta: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
	// theme is exposed because the badge is the only save-status signal left on the page: amber unsaved, green saved.
	Badge: {
		props: ['theme'],
		template: `<span class="badge" :data-theme="theme"><slot /></span>`,
	},
	LoadingIndicator: { template: `<span />` },
	Alert: {
		props: {
			title: String,
			description: String,
			theme: String,
			variant: String,
			dismissible: { type: Boolean, default: true },
		},
		emits: ['dismiss'],
		template: `<div role="alert" :data-theme="theme"><span>{{ title }}</span><slot name="description">{{ description }}</slot><button v-if="dismissible" type="button" aria-label="Dismiss" @click="$emit('dismiss')" /><slot name="footer" /></div>`,
	},
	Tooltip: { template: `<span><slot /></span>` },
	Button: {
		inheritAttrs: false,
		// variant defaults to 'subtle' exactly as frappe-ui's Button does.
		props: {
			variant: { type: String, default: 'subtle' },
			theme: String,
			disabled: Boolean,
			label: String,
			icon: String,
		},
		emits: ['click'],
		// Mirrors Button.vue: `icon` (or an #icon slot) makes it an icon button,
		// rendering the glyph ALONE with the label only as the accessible name, while
		// a labelled button renders the word in a truncating span.
		template: `<button
			v-bind="$attrs"
			:aria-label="label || $attrs['aria-label']"
			:data-variant="variant"
			:data-theme="theme || ''"
			:data-icon-button="icon ? 'true' : undefined"
			:disabled="disabled"
			@click="$emit('click')"
		><template v-if="icon"><span :class="icon" /></template><template v-else><slot name="prefix" /><slot name="icon" /><slot /><span v-if="label" class="truncate">{{ label }}</span></template></button>`,
	},
	// `variant` and `disabled` are exposed because the read-only fields in the Details panel are only right if they carry both: frappe-ui's FormControl defaults to the grey filled `subtle` box.
	FormControl: {
		// `disabled` is typed, not listed: the page writes it as a bare attribute, which Vue hands an untyped prop as '', falsy, and the stub would report a read-only field as editable.
		props: {
			modelValue: null,
			label: String,
			type: String,
			placeholder: String,
			variant: String,
			disabled: Boolean,
		},
		emits: ['update:modelValue'],
		// TextInput.vue puts class and style on the wrapper and binds every other
		// attr, listeners included, onto the input itself.
		inheritAttrs: false,
		computed: {
			inputAttrs(this: any) {
				const { class: _c, style: _s, ...rest } = this.$attrs
				return rest
			},
		},
		template: `<label :class="$attrs.class" :data-variant="variant" :data-disabled="disabled ? 'true' : 'false'">{{ label }}<slot name="label" /><input v-bind="inputAttrs" :type="type" :placeholder="placeholder" :value="modelValue" :disabled="disabled" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	// Menu options are rendered as real buttons so the route pushes behind Preview/Submissions/Delete are reachable, and `theme` is exposed so the destructive row can be asserted rather than assumed.
	Dropdown: {
		props: ['options', 'placement'],
		template: `<div class="dropdown">
      <slot :open="false" />
      <button
        v-for="opt in options"
        :key="opt.label"
        type="button"
        data-testid="menu-option"
        :data-theme="opt.theme || ''"
        @click="opt.onClick && opt.onClick()"
      >{{ opt.label }}</button>
    </div>`,
	},
}))

vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: {
		props: ['breadcrumbs', 'loading'],
		template: `<header><slot name="actions" /></header>`,
	},
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		props: {
			label: String,
			icon: String,
			theme: String,
			variant: { type: String, default: 'subtle' },
			disabled: Boolean,
		},
		emits: ['click'],
		template: `<button v-bind="$attrs" :data-variant="variant" :disabled="disabled" @click="$emit('click')">{{ label }}</button>`,
	},
}))
vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: { props: ['modelValue', 'label'], template: `<div />` },
}))

// Renders the item slot for every row, exactly as vuedraggable does, and exposes `list` (the doc's own array) so a test can reorder it in place the way a drag would.
vi.mock('vuedraggable', () => ({
	default: {
		name: 'Draggable',
		props: ['list', 'itemKey', 'handle', 'disabled'],
		template: `<div class="draggable" :data-disabled="disabled ? 'true' : 'false'">
      <template v-for="(element, index) in list" :key="element.name">
        <slot name="item" :element="element" :index="index" />
      </template>
    </div>`,
	},
}))

// `data-mount-id` counts mounts across the whole file: a card that is torn down and rebuilt comes back with a new one.
vi.mock('@/components/Quiz/QuestionCard.vue', () => {
	let mounts = 0
	return {
		default: {
			name: 'QuestionCard',
			props: [
				'row',
				'index',
				'quizName',
				'editing',
				'draft',
				'reorderDisabled',
				'usageCount',
				'allowedUiTypes',
				'persisting',
			],
			emits: [
				'edit',
				'done',
				'changed',
				'deleted',
				'duplicated',
				'request-persist',
				'draft-discarded',
				'type-changed',
				'dirty-change',
			],
			setup: () => ({ mountId: ++mounts }),
			template: `<div
        class="question-card"
        :data-name="row.name"
        :data-type="row.type"
        :data-marks="row.marks"
        :data-detail="row.question_detail"
        :data-question="row.question"
        :data-draft="draft ? 'true' : 'false'"
        :data-editing="editing ? 'true' : 'false'"
        :data-reorder-disabled="reorderDisabled ? 'true' : 'false'"
        :data-allowed="(allowedUiTypes || []).join(',')"
        :data-persisting="persisting ? 'true' : 'false'"
        :data-mount-id="mountId"
      ><button
          data-testid="type-into-card"
          @click="row.question_detail = '<p>half typed</p>'; row.marks = 7"
        /><button
          data-testid="pick-open-ended"
          @click="$emit('type-changed', { type: 'Open Ended', multiple: 0 })"
        /></div>`,
		},
	}
})

// Faithful to QuestionBankPanel.vue's own contract, because a stub is an assertion about the real thing: the props and defaults it declares, the three events it emits, the early return on an empty selection, and the fact that addSelected reaches the parent ONLY through defineExpose. setup returns {} on purpose. vue-test-utils' `wrapper.vm` proxies the whole <script setup> scope whether or not defineExpose published it, so a method left on the instance would pass even if the panel exposed nothing, while a parent's template ref, which resolves the exposed object, would get undefined.
vi.mock('@/components/Quiz.vue', () => ({
	default: {
		name: 'Quiz',
		props: {
			quizName: { type: String, required: true },
			preview: { type: Boolean, default: false },
		},
		template: `<div data-testid="student-quiz" :data-quiz="quizName" :data-preview="preview" />`,
	},
}))

vi.mock('@/components/Quiz/QuestionBankPanel.vue', () => ({
	default: {
		name: 'QuestionBankPanel',
		props: {
			quizName: { type: String, required: true },
			initialType: { type: String, default: '' },
			inQuizQuestionNames: { type: Array, default: () => [] },
		},
		emits: ['added', 'close', 'selection-change'],
		setup(_props: unknown, { expose, emit }: any) {
			// onMounted clears the selection and the count watch is `immediate`, so a
			// panel that has just been mounted reports nothing picked.
			bankSelection.count = 0
			emit('selection-change', 0)

			const addSelected = () => {
				bankAddSelected()
				// `if (!picked.length) return`, neither event is emitted.
				if (!bankSelection.count) return
				emit('added', bankPicks.value)
				// Statement order in the real component is emit('added') -> selected.clear() -> emit('close').
				bankSelection.count = 0
				emit('selection-change', 0)
				emit('close')
			}
			expose({ addSelected })
			return {}
		},
		template: `<div
      data-testid="bank"
      :data-initial-type="initialType"
      :data-in-quiz="(inQuizQuestionNames || []).join(',')"
    />`,
	},
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))
vi.mock('@/composables/useKeyboardShortcuts', () => ({
	useKeyboardShortcuts: vi.fn(),
	saveShortcut: (action: () => void) => ({ keys: 's', action }),
}))

import QuizForm from '@/pages/Forms/QuizForm.vue'
import { toast } from 'frappe-ui'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

const $dialog = vi.fn()

const CHOICE_ROW = {
	idx: 1,
	name: 'qq1',
	question: 'Q1',
	type: 'Choices',
	marks: 2,
	question_detail: '<p>2+2?</p>',
}
const OPEN_ENDED_ROW = {
	idx: 2,
	name: 'qq2',
	question: 'Q2',
	type: 'Open Ended',
	marks: 3,
	question_detail: '<p>Discuss.</p>',
}

// What QuestionBankPanel emits for one picked question, and what QuestionCard emits for a copy it has just inserted into the bank.
const BANK_PICK = {
	question: 'Q9',
	marks: 3,
	type: 'Choices',
	multiple: 0,
	question_detail: '<p>From the bank</p>',
}
const COPY_OF_Q1 = {
	question: 'NEW-1',
	marks: 2,
	type: 'Choices',
	multiple: 0,
	question_detail: '<p>2+2?</p>',
}

const sumMarks = (questions: Doc[]) =>
	questions.reduce((total, row) => total + (row.marks || 0), 0)

// total_marks agrees with the questions on load, exactly as it does in production: LMS Quiz.validate recomputes it on every save.
const quizDoc = (questions: Doc[] = [], overrides: Doc = {}): Doc => ({
	name: 'QZ-0001',
	doctype: 'LMS Quiz',
	title: 'Saved title',
	passing_percentage: 50,
	total_marks: sumMarks(questions),
	questions,
	...overrides,
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/quizzes', name: 'Quizzes', component: { template: '<div />' } },
			// The real component, with props from the route exactly as routes.js declares it. onBeforeRouteLeave resolves the record it guards through the enclosing router-view, so a QuizForm mounted standalone registers no guard at all and every leave test would pass vacuously.
			{
				path: '/quizzes/edit/:quizID',
				name: 'QuizForm',
				component: QuizForm,
				props: true,
			},
			{
				path: '/quizzes/new',
				name: 'NewQuiz',
				component: QuizForm,
			},
			{
				path: '/quizzes/:quizID/preview',
				name: 'QuizPage',
				component: { template: '<div />' },
			},
			{
				path: '/quizzes/submissions',
				name: 'QuizSubmissions',
				component: { template: '<div />' },
			},
		],
	})

const mountForm = async (
	questions: Doc[] = [],
	overrides: Doc = {},
	quizID = 'QZ-0001'
) => {
	server.doc = quizDoc(questions, { name: quizID, ...overrides })
	const router = makeRouter()
	await router.push({ name: 'QuizForm', params: { quizID } })
	await router.isReady()
	// Mounted through a router-view, not directly, so the page is a routed component the way it is in the app.
	const host = mount(
		{ template: '<router-view />' },
		{
			global: {
				plugins: [router],
				provide: { $user: { data: { name: 'mod@x.com', is_moderator: true } } },
				config: { globalProperties: { $dialog } },
				mocks: { __: (text: string) => text },
			},
		}
	)
	await flushPromises()
	// `any`: the assertions read setup state (quizDetails) off the instance, which a <script setup> component's public type does not carry.
	return { wrapper: host.findComponent(QuizForm) as any, router, host }
}

// The Create button's destination: a form with no quiz behind it at all.
const mountNewQuiz = async () => {
	const router = makeRouter()
	await router.push({ name: 'NewQuiz' })
	await router.isReady()
	const host = mount(
		{ template: '<router-view />' },
		{
			global: {
				plugins: [router],
				provide: { $user: { data: { name: 'mod@x.com', is_moderator: true } } },
				config: { globalProperties: { $dialog } },
				mocks: { __: (text: string) => text },
			},
		}
	)
	await flushPromises()
	return { wrapper: host.findComponent(QuizForm) as any, router, host }
}

const doc = (wrapper: any) => wrapper.vm.quizDetails.doc as Doc
const cards = (wrapper: any) => wrapper.findAll('.question-card')
const cardFor = (wrapper: any, name: string) =>
	cards(wrapper).find((c: any) => c.attributes('data-name') === name)
const draggable = (wrapper: any) => wrapper.findComponent({ name: 'Draggable' })

// The draft lives in its own ref, so it is read off the component rather than hunted for in doc.questions, which is the whole point of the refactor.
const draftRow = (wrapper: any) => wrapper.vm.draft as Doc | null
const draftCard = (wrapper: any) =>
	wrapper.find('[data-testid="draft-card"] .question-card')
const cardComponents = (wrapper: any) =>
	wrapper.findAllComponents({ name: 'QuestionCard' })
const draftComponent = (wrapper: any) =>
	cardComponents(wrapper).find((c: any) => c.props('draft'))
const rowComponent = (wrapper: any, name: string) =>
	cardComponents(wrapper).find((c: any) => c.props('row').name === name)
const listRowNames = (wrapper: any) =>
	doc(wrapper).questions.map((row: Doc) => row.name)

const emitFromRow = async (
	wrapper: any,
	name: string,
	event: string,
	payload?: unknown
) => {
	rowComponent(wrapper, name)!.vm.$emit(event, payload)
	await flushPromises()
}

// The toolbar row above the list.
const toolbar = (wrapper: any) => {
	const rows = wrapper.findAll('[data-testid="question-toolbar"]')
	expect(rows).toHaveLength(1)
	return rows[0]
}
const toolbarButton = (wrapper: any, label: string) =>
	toolbar(wrapper)
		.findAll('button')
		.find((button: any) => button.text() === label)
const toolbarLabels = (wrapper: any) =>
	toolbar(wrapper)
		.findAll('button')
		.map((button: any) => button.text())

const addDraft = async (wrapper: any) => {
	await toolbarButton(wrapper, 'New question')!.trigger('click')
	await flushPromises()
}

// Types into the draft the way the real card does: it writes onto the row object it was handed.
const typeIntoDraft = async (wrapper: any) => {
	await draftCard(wrapper)
		.find('[data-testid="type-into-card"]')
		.trigger('click')
	await flushPromises()
}

const openBank = async (wrapper: any) => {
	await toolbarButton(wrapper, 'Question bank')!.trigger('click')
	await flushPromises()
}
const bankPanel = (wrapper: any) =>
	wrapper.findComponent({ name: 'QuestionBankPanel' })

// Ticking a checkbox grows the set the panel's own add reads.
const selectInBank = async (wrapper: any, count: number) => {
	bankSelection.count = count
	bankPanel(wrapper).vm.$emit('selection-change', count)
	await flushPromises()
}

// The whole flow, through the toolbar, because that is the only way in: open, tick, press Add questions.
const addFromBank = async (wrapper: any, picks: Doc[] = [BANK_PICK]) => {
	await openBank(wrapper)
	bankPicks.value = picks
	await selectInBank(wrapper, picks.length)
	await toolbarButton(wrapper, 'Add questions')!.trigger('click')
	await flushPromises()
}

// Preview / Submissions / Delete are plain header buttons now, there is no overflow menu, and no Save button at all: autosave is the save mechanism and Cmd/Ctrl+S is the only way to force a flush.
const headerButton = (wrapper: any, label: string) =>
	wrapper.findAll('header button').find((b: any) => b.text() === label)
const badge = (wrapper: any) => wrapper.find('.badge')

// The Cmd/Ctrl+S path, taken straight off the registration so a guard that only covers the button cannot pass.
const pressSave = async () => {
	const options = vi.mocked(useKeyboardShortcuts).mock.calls.at(-1)![0] as any
	options.shortcuts[0].action()
	await flushPromises()
}

const labelledField = (wrapper: any, label: string) =>
	wrapper.findAll('label').find((l: any) => l.text().startsWith(label))

const typeTitle = async (wrapper: any, value: string) => {
	const title = wrapper
		.findAll('label')
		.find((l: any) => l.text().startsWith('Title'))!
	await title.find('input').setValue(value)
}

// Save is disabled while the doc is pristine, and a disabled button swallows the click, so a save assertion has to dirty the doc first.
const makeDirty = (wrapper: any) => typeTitle(wrapper, 'Edited title')

// Nothing but the mount fetch and the usage lookup may have gone out.
const expectNothingWritten = () => {
	expect(calls.inserts).toEqual([])
	expect(calls.deletes).toEqual([])
	expect(calls.urls.filter((url) => url !== META_URL)).toEqual([])
	expect(setValueSubmit).not.toHaveBeenCalled()
	expect(reloadSpy).toHaveBeenCalledTimes(1)
}

// useScreenSize() reads window.innerWidth at setup, so a width has to be set before
// the mount, not after it.
const PHONE = 375
const DESKTOP = 1024
const setViewport = (width: number): void => {
	Object.defineProperty(window, 'innerWidth', {
		value: width,
		writable: true,
		configurable: true,
	})
}

beforeEach(() => {
	setViewport(DESKTOP)
	calls.inserts.length = 0
	calls.deletes.length = 0
	calls.urls.length = 0
	calls.hold = null
	// Reset, not clear: a test that installs a lasting mockImplementation would otherwise leave it in place for every test after it, and mockClear only wipes the recorded calls.
	setValueSubmit.mockReset()
	setValueSubmit.mockImplementation(savedSetValue)
	deleteSubmit.mockClear()
	reloadSpy.mockClear()
	bankAddSelected.mockClear()
	bankSelection.count = 0
	bankPicks.value = [BANK_PICK]
	// The notice's dismissal lives here, and it outlives a mount by design.
	sessionStorage.clear()
	viewportWidth = 1280
	$dialog.mockReset()
	vi.mocked(toast.success).mockClear()
	vi.mocked(toast.error).mockClear()
	vi.mocked(toast.dismiss).mockClear()
})

// frappe-ui's setValue.onError restores the doc by REPLACING the object
// (documentResource.js:58), tripping the deep watcher, so the failed tick
// re-arms every 1.2s. A mock leaving doc alone would pass with no guard at all.
describe('QuizForm: autosave', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	const IDLE = 1200
	const idle = async (ms = IDLE) => {
		await vi.advanceTimersByTimeAsync(ms)
		await flushPromises()
	}

	it('does not retry a failed autosave in a loop', async () => {
		setValueSubmit.mockImplementation((params: any, options: any) =>
			failedSetValue(params, options, { messages: ['nope'] })
		)
		const { wrapper } = await mountForm([CHOICE_ROW])
		await makeDirty(wrapper)
		await idle()
		expect(setValueSubmit).toHaveBeenCalledTimes(1)

		await idle(10000)
		expect(setValueSubmit).toHaveBeenCalledTimes(1)
	})
})

// The redirects run against the real route table, not a hand-made one: the whole
// point is that vue-router scores these the way routes.js declares them. Components
// are stubbed because a push resolves the target's lazy import, which would drag
// every real page into this file.
describe('legacy quiz URLs', () => {
	const stub = { template: '<div />' }
	type Rec = Record<string, unknown> & { children?: Rec[]; component?: unknown }

	const stubbed = (records: Rec[]): Rec[] =>
		records.map((record) => ({
			...record,
			...(record.component ? { component: stub } : {}),
			...(record.children ? { children: stubbed(record.children) } : {}),
		}))

	const realRouter = async (): Promise<Router> => {
		const { routes } = await import('@/routes')
		const router = createRouter({
			history: createMemoryHistory(),
			routes: stubbed(routes as unknown as Rec[]) as never,
		})
		await router.push('/')
		await router.isReady()
		return router
	}

	it.each([
		['/quizzes/some-quiz', '/quizzes/edit/some-quiz'],
		['/quizzes/some-quiz/question/q-1', '/quizzes/edit/some-quiz'],
		['/quiz-submissions/some-quiz', '/quizzes/submissions?quiz=some-quiz'],
	])('sends %s to %s', async (from, to) => {
		const router = await realRouter()
		await router.push(from)
		expect(router.currentRoute.value.fullPath).toBe(to)
	})

	// The redirect is a bare `:quizID`, so it sits alongside the static siblings it
	// must never swallow. A quiz whose docname is `new` stays unreachable, which is
	// the trade routes.js already documents.
	it.each([
		['/quizzes/submissions', 'QuizSubmissions'],
		['/quizzes/questions', 'Questions'],
		['/quizzes/new', 'NewQuiz'],
		['/quizzes/edit/some-quiz', 'QuizForm'],
	])('leaves %s resolving to %s', async (path, name) => {
		const router = await realRouter()
		await router.push(path)
		expect(router.currentRoute.value.name).toBe(name)
	})
})
