// Basic setup's settings steps. Sign-up and the sidebar leave nothing in the
// data that says they were configured, so their steps tick when the tab
// saves. Branding has a server fact, so its tab asks for the facts again.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { FieldsPage } from '@/types/settingsSchema'

const { completeStep, refetchFacts, autosaveOptions, source, brandSubmit } =
	vi.hoisted(() => {
		// Settings reaches @/utils, which pulls in plyr. Plyr touches
		// matchMedia at import time, and jsdom has none.
		window.matchMedia ??= (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia
		return {
			completeStep: vi.fn(),
			refetchFacts: vi.fn(),
			brandSubmit: vi.fn(),
			autosaveOptions: [] as { write: () => Promise<unknown> }[],
			source: {
				doc: {} as Record<string, unknown>,
				isDirty: true,
				isNew: false,
				name: 'LMS Settings',
				save: vi.fn(),
				reload: vi.fn(),
			},
		}
	})

// BrandSettings reads Website Settings through get_branding and writes it
// through set_value; every other resource stays real.
vi.mock('frappe-ui', async (importOriginal) => {
	const actual = await importOriginal<typeof import('frappe-ui')>()
	return {
		...actual,
		createResource: (options: { url: string }) => {
			if (options.url === 'lms.lms.api.get_branding')
				return { data: { app_name: 'Acme' } }
			if (options.url === 'frappe.client.set_value')
				return { submit: brandSubmit }
			return actual.createResource(options)
		},
	}
})

vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({ completeStep, refetchFacts }),
}))

vi.mock('@/composables/useAutosave', () => ({
	useAutosave: (options: { write: () => Promise<unknown> }) => {
		autosaveOptions.push(options)
		return { status: ref('idle'), commit: vi.fn(), cancel: vi.fn() }
	},
}))

vi.mock('@/composables/useSettingsSource', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/composables/useSettingsSource')>()),
	useSettingsSource: () => source,
	reportSaveFailure: vi.fn(),
}))

vi.mock('@/composables/useDirtyGuard', () => ({ useDirtyGuard: vi.fn() }))

vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))

vi.mock('@/components/Layouts/settings/desktop/SettingsFields.vue', () => ({
	default: { template: '<div />' },
}))

vi.mock('@/components/Controls/ImageUploadField.vue', () => ({
	default: { template: '<div />' },
}))

vi.stubGlobal('__', (text: string) => text)

const lastWrite = () => autosaveOptions[autosaveOptions.length - 1].write()

beforeEach(() => {
	autosaveOptions.length = 0
	completeStep.mockReset()
	refetchFacts.mockReset()
	source.save.mockReset()
})

async function mountPanel(page: FieldsPage) {
	const SettingsFieldsPanel = (
		await import(
			'@/components/Layouts/settings/desktop/SettingsFieldsPanel.vue'
		)
	).default
	return mount(SettingsFieldsPanel, {
		props: { page },
		global: { mocks: { __: (s: string) => s } },
	})
}

const autoPage = (onAutosaved: () => void): FieldsPage => ({
	kind: 'fields',
	source: { doc: 'LMS Settings' },
	save: 'auto',
	sections: [],
	onAutosaved,
})

describe('an autosaved settings page', () => {
	// Guards: a settings tab that ticks an onboarding step on save never being
	// told its autosave landed. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there with the hook.
	it('runs onAutosaved once the write lands', async () => {
		source.save.mockResolvedValue({})
		const onAutosaved = vi.fn()
		await mountPanel(autoPage(onAutosaved))
		await lastWrite()
		expect(onAutosaved).toHaveBeenCalledTimes(1)
	})

	// Guards: a refused write ticking the step as if it saved. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there with
	// the hook.
	it('skips onAutosaved when the write is refused', async () => {
		source.save.mockRejectedValue(new Error('refused'))
		const onAutosaved = vi.fn()
		await mountPanel(autoPage(onAutosaved))
		await expect(lastWrite()).rejects.toThrow('refused')
		expect(onAutosaved).not.toHaveBeenCalled()
	})
})

describe('basic setup settings tabs', () => {
	const items = async () => {
		const { settingsTree } = await import('@/components/Settings/settings')
		return settingsTree.flatMap((group) => group.items)
	}

	// Guards: a basic setup step opening a settings slug that does not exist.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check the slugs against the tree.
	it('opens slugs the settings tree has', async () => {
		const slugs = (await items()).map((item) => item.slug)
		for (const slug of [
			'email-accounts',
			'branding',
			'signup',
			'sidebar',
			'communication-general',
		])
			expect(slugs).toContain(slug)
	})

	// Guards: saving the sign-up tab leaving Set up sign-up open. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to tick
	// it on save.
	it('ticks Set up sign-up when the sign-up tab saves', async () => {
		const signup = (await items()).find((item) => item.slug === 'signup')!
		const page = signup.page as FieldsPage
		page.onAutosaved?.()
		expect(completeStep).toHaveBeenCalledWith('setup_signup')
	})

	// Guards: saving a contact email leaving Set a contact email open until the
	// window regains focus. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to read the facts after a save.
	it('reads the facts again when the communication tab saves', async () => {
		const tab = (await items()).find(
			(item) => item.slug === 'communication-general'
		)!
		const page = tab.page as FieldsPage
		page.onAutosaved?.()
		expect(refetchFacts).toHaveBeenCalledTimes(1)
		expect(completeStep).not.toHaveBeenCalled()
	})
})

describe('the branding tab', () => {
	// Guards: saving the brand leaving Add your branding open until the window
	// regains focus. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to read the facts after a save.
	it('reads the facts again once a save lands', async () => {
		brandSubmit.mockResolvedValue({})
		const BrandSettings =
			// @ts-expect-error TS7016: BrandSettings.vue is an untyped SFC
			(await import('@/components/Settings/BrandSettings.vue')).default
		mount(BrandSettings, { global: { mocks: { __: (s: string) => s } } })
		await lastWrite()
		await flushPromises()
		expect(brandSubmit).toHaveBeenCalled()
		expect(refetchFacts).toHaveBeenCalledTimes(1)
	})
})
