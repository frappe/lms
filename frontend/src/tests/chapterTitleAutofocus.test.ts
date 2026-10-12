import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// The real frappe-ui FormControl and Dialog, unlike chapterForm.test.ts: the
// claim under test is that frappe-ui forwards `autofocus` onto the <input> and
// that its Dialog focuses it. Only the network and toasts are replaced.
const { createResourceMock } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { createResourceMock: vi.fn() }
})

// Deep imports: the barrel drags in exports this installed frappe-ui lacks.
vi.mock('frappe-ui', async () => ({
	Dialog: (
		await import(
			'../../node_modules/frappe-ui/src/components/Dialog/Dialog.vue'
		)
	).default,
	FormControl: (
		await import(
			'../../node_modules/frappe-ui/src/components/FormControl/FormControl.vue'
		)
	).default,
	Button: { template: `<button><slot /></button>` },
	FileUploader: { template: `<div />` },
	createResource: createResourceMock,
	getCachedResource: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/HeaderButton.vue', () => ({
	default: { inheritAttrs: false, template: `<button v-bind="$attrs" />` },
}))
vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: { props: ['modelValue', 'label', 'description', 'size'] },
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))

import ChapterForm from '@/pages/Forms/ChapterForm.vue'

createResourceMock.mockImplementation(() => ({
	data: null,
	loading: false,
	fetch: vi.fn(),
	reload: vi.fn(),
	submit: vi.fn(),
}))

enableAutoUnmount(afterEach)

const nextFrame = (): Promise<void> =>
	new Promise((resolve) => requestAnimationFrame(() => resolve()))

const openNewChapter = async (width: number) => {
	// useScreenSize reads innerWidth at setup, so set it before mounting.
	Object.defineProperty(window, 'innerWidth', {
		value: width,
		writable: true,
		configurable: true,
	})
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/courses/:courseName/chapter/:chapterName',
				name: 'ChapterForm',
				component: ChapterForm,
				props: true,
			},
		],
	})
	await router.push('/courses/COURSE-1/chapter/new')
	mount(defineComponent({ render: () => h(RouterView) }), {
		attachTo: document.body,
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'mod@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	await nextFrame()
}

const titleInput = (): HTMLInputElement | null =>
	document.querySelector('[data-testid="chapter-fields"] input')

// jsdom applies no CSS, so these prove where focus() was called, not that a
// browser accepted it. The mobile page enters at opacity-0 (still focusable),
// and the Dialog's open animation is not checked here at all.
describe('Add Chapter puts the cursor in Title', () => {
	it('on desktop, through the Dialog', async () => {
		await openNewChapter(1024)
		const input = titleInput()
		expect(input?.hasAttribute('autofocus')).toBe(true)
		expect(document.activeElement).toBe(input)
	})

	it('on mobile, through the full-page shell', async () => {
		await openNewChapter(390)
		const input = titleInput()
		expect(input).not.toBeNull()
		expect(document.activeElement).toBe(input)
	})
})
