/**
 * Tests for ChapterModal.vue — specifically how it handles a failed submit.
 *
 * frappe-ui's createResource rethrows after running onError (resources.js
 * handleError), so a submit() whose result is neither awaited nor caught leaves
 * a rejected promise with no handler. On a SCORM chapter that surfaced in
 * production as an uncaught "Please upload a SCORM package" in the console when
 * Create was clicked before the upload had populated scorm_package.
 *
 * The mocked createResource below mirrors that contract exactly: validate()
 * returning a string becomes `new Error(message)`, which is passed to onError
 * and then rethrown.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ChapterModal from '@/components/Modals/ChapterModal.vue'

interface SubmitOptions {
	makeParams?: () => Record<string, unknown>
	validate?: () => string | undefined
	onSuccess?: (data: unknown) => void
	onError?: (error: unknown) => void
}

interface DialogAction {
	label: string
	onClick: (ctx: { close: () => void }) => Promise<void>
}

const { toastMock, closeMock, resourceCall, updateOnboardingStepMock } =
	vi.hoisted(() => ({
		toastMock: { success: vi.fn(), error: vi.fn() },
		closeMock: vi.fn(),
		resourceCall: vi.fn(),
		updateOnboardingStepMock: vi.fn(),
	}))

vi.mock('frappe-ui', () => ({
	toast: toastMock,
	createResource: (options: SubmitOptions) => ({
		async submit(params: unknown, tempOptions: SubmitOptions = {}) {
			const opts = { ...options, ...tempOptions }
			try {
				const invalid = await opts.validate?.()
				if (invalid) {
					throw new Error(invalid)
				}
				// The real resource builds the payload from makeParams(); a mock that
				// forwards the caller's literal {} silently covers nothing, and the
				// `name` that decides insert-vs-update lives only in makeParams.
				const data = await resourceCall(opts.makeParams?.() ?? params)
				opts.onSuccess?.(data)
				return data
			} catch (error) {
				opts.onError?.(error)
				throw error
			}
		},
	}),
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'actions'],
		setup() {
			return { closeMock }
		},
		template: `
			<div v-if="open">
				<slot />
				<button
					v-for="a in actions"
					:key="a.label"
					:data-testid="'action-' + a.label"
					@click="a.onClick({ close: closeMock })"
				>{{ a.label }}</button>
			</div>
		`,
	},
	FormControl: {
		props: ['modelValue', 'label'],
		emits: ['update:modelValue'],
		template: `
			<input
				data-testid="field-title"
				:value="modelValue"
				@input="$emit('update:modelValue', $event.target.value)"
			/>
		`,
	},
	FileUploader: { template: '<div />' },
	Button: { template: '<button><slot /></button>' },
}))

vi.mock('frappe-ui/frappe', () => ({
	useOnboarding: () => ({ updateOnboardingStep: updateOnboardingStepMock }),
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'size', 'description'],
		emits: ['update:modelValue'],
		template: `
			<button
				data-testid="scorm-toggle"
				@click="$emit('update:modelValue', modelValue ? 0 : 1)"
			/>
		`,
	},
}))

vi.mock('@/utils/', () => ({ getFileSize: () => '1 KB' }))

vi.stubGlobal('__', (s: string) => s)

const mountModal = (
	props: Record<string, unknown> = {},
	isSystemManager = false
) =>
	mount(ChapterModal, {
		props: { modelValue: true, course: 'course-1', ...props },
		global: {
			provide: { $user: { data: { is_system_manager: isSystemManager } } },
			mocks: { __: (s: string) => s },
		},
	})

type Wrapper = ReturnType<typeof mountModal>

// Drive the Dialog action the way the real Dialog does: await the handler, the
// way Dialog.vue's `await action.onClick(ctx)` wrapper does.
const clickAction = (w: Wrapper, label: string): Promise<void> => {
	const actions = w
		.findComponent({ name: 'Dialog' })
		.props('actions') as DialogAction[]
	const action = actions.find((a) => a.label === label)
	if (!action) throw new Error(`No dialog action labelled ${label}`)
	return action.onClick({ close: closeMock })
}

const setTitle = async (w: Wrapper, title: string) => {
	await w.get('[data-testid="field-title"]').setValue(title)
}

// tsconfig sets `types: []`, so node's globals aren't ambient here. Only the
// two members this file uses are declared.
declare const process: {
	on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
	off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
}

// Rejections escape to node, not to jsdom's window — a window listener sits
// there recording nothing and the assertion passes vacuously.
const captureUnhandled = () => {
	const reasons: unknown[] = []
	const listener = (reason: unknown) => reasons.push(reason)
	process.on('unhandledRejection', listener)
	return {
		reasons,
		async stop() {
			await flushPromises()
			await new Promise((resolve) => setTimeout(resolve, 0))
			process.off('unhandledRejection', listener)
		},
	}
}

const enableScorm = async (w: Wrapper) => {
	await w.get('[data-testid="scorm-toggle"]').trigger('click')
}

beforeEach(() => {
	toastMock.success.mockReset()
	toastMock.error.mockReset()
	closeMock.mockReset()
	resourceCall.mockReset()
	resourceCall.mockResolvedValue({ name: 'chapter-1' })
	updateOnboardingStepMock.mockReset()
})

describe('ChapterModal — failed submit', () => {
	it('toasts the validation reason rather than a bare "Error"', async () => {
		const w = mountModal()
		await setTitle(w, 'Module 1')
		await enableScorm(w)

		await clickAction(w, 'Create')

		expect(toastMock.error).toHaveBeenCalledWith(
			'Please upload a SCORM package'
		)
	})

	it('does not leave the rejected submit unhandled', async () => {
		const watcher = captureUnhandled()
		const w = mountModal()
		await setTitle(w, 'Module 1')
		await enableScorm(w)

		await expect(clickAction(w, 'Create')).resolves.toBeUndefined()

		await watcher.stop()
		expect(watcher.reasons).toEqual([])
	})

	it('keeps the dialog open and does not emit created', async () => {
		const w = mountModal()
		await setTitle(w, 'Module 1')
		await enableScorm(w)

		await clickAction(w, 'Create')

		expect(closeMock).not.toHaveBeenCalled()
		expect(w.emitted('created')).toBeUndefined()
		expect(resourceCall).not.toHaveBeenCalled()
	})

	it('reports a network failure without printing raw browser text', async () => {
		resourceCall.mockRejectedValue(new TypeError('Failed to fetch'))
		const w = mountModal()
		await setTitle(w, 'Module 1')

		await expect(clickAction(w, 'Create')).resolves.toBeUndefined()

		expect(toastMock.error).toHaveBeenCalledWith(
			'Something went wrong. Please try again.'
		)
	})

	it('does not report a saved chapter as failed when onSuccess throws', async () => {
		// frappe-ui's useOnboarding throws when the app has no onboarding
		// registered; onSuccess calls it first, for a System Manager.
		updateOnboardingStepMock.mockImplementation(() => {
			throw new TypeError("Cannot read properties of undefined (reading 'map')")
		})
		const w = mountModal({}, true)
		await setTitle(w, 'Module 1')

		// The record was created; the bug is ours, so it must not be dressed up as
		// a request failure the moderator should retry — that is what produced a
		// duplicate chapter.
		await expect(clickAction(w, 'Create')).rejects.toThrow('reading')
		expect(resourceCall).toHaveBeenCalledTimes(1)
		expect(toastMock.error).not.toHaveBeenCalled()
	})
})

describe('ChapterModal — payload', () => {
	it('sends the chapter name on edit, so upsert updates instead of inserting', async () => {
		const w = mountModal()
		await w.setProps({
			chapterDetail: { name: 'chapter-1', title: 'Module 1' },
		})
		await flushPromises()

		await clickAction(w, 'Edit')

		expect(resourceCall).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'chapter-1',
				title: 'Module 1',
				course: 'course-1',
			})
		)
	})

	it('posts an object when the SCORM File row is gone and only a docname survives', async () => {
		const w = mountModal()
		await w.setProps({
			chapterDetail: {
				name: 'chapter-1',
				title: 'Module 1',
				is_scorm_package: 1,
				// build_outline leaves the raw docname when the File is deleted.
				scorm_package: 'orphaned-file-docname',
			},
		})
		await flushPromises()

		await clickAction(w, 'Edit')

		// upsert_chapter does frappe._dict(scorm_package or {}) — a string is a
		// ValueError, i.e. a 500 that makes the chapter unrenameable.
		const [payload] = resourceCall.mock.calls[0] as [Record<string, unknown>]
		expect(payload.scorm_package).toEqual({
			name: 'orphaned-file-docname',
			file_name: 'orphaned-file-docname',
		})
	})
})

describe('ChapterModal — action awaits the submit', () => {
	it('stays pending until the submit settles, so the button can show loading', async () => {
		let release: (value: unknown) => void = () => {}
		resourceCall.mockReturnValue(
			new Promise((resolve) => {
				release = resolve
			})
		)

		const w = mountModal()
		await setTitle(w, 'Module 1')

		let settled = false
		const pending = clickAction(w, 'Create').then(() => {
			settled = true
		})

		await flushPromises()
		expect(settled).toBe(false)

		release({ name: 'chapter-1' })
		await pending
		expect(settled).toBe(true)
		expect(toastMock.success).toHaveBeenCalledWith('Chapter added successfully')
	})
})

describe('ChapterModal — edit mode', () => {
	it('does not leave a rejected edit submit unhandled', async () => {
		const watcher = captureUnhandled()
		const w = mountModal()
		// The chapterDetail watch has no `immediate`, so the prop has to change
		// after mount for the form to pick the existing chapter up.
		await w.setProps({
			chapterDetail: { name: 'chapter-1', title: 'Module 1' },
		})
		await flushPromises()
		resourceCall.mockRejectedValue({ messages: ['Chapter is locked'] })

		await expect(clickAction(w, 'Edit')).resolves.toBeUndefined()

		await watcher.stop()
		expect(watcher.reasons).toEqual([])
		expect(toastMock.error).toHaveBeenCalledWith('Chapter is locked')
	})
})
