/**
 * Frappe version-15 ships the one-page data import and version-16 (from
 * 16.53.0) the step wizard. The page shows whichever this bench's frappe has.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const KIT = '@framework/ui/components/DataImport/index'
const stub = (name: string) => defineComponent({ name, render: () => h('div', name) })

vi.mock('@/pages/DataImport/Wizard.vue', () => ({ default: stub('WizardFlow') }))
vi.mock('@/pages/DataImport/Legacy.vue', () => ({ default: stub('LegacyFlow') }))
vi.mock('@/pages/DataImport/List.vue', () => ({ default: stub('ImportList') }))

const route = vi.hoisted(() => ({ name: 'DataImport' as string }))
vi.mock('vue-router', () => ({ useRoute: () => route }))
const WIZARD_KIT = () => ({ DataImportWizard: stub('DataImportWizard'), useDataImport: () => ({}) })

let wrapper: VueWrapper | undefined

afterEach(() => {
	route.name = 'DataImport'
	wrapper?.unmount()
	wrapper = undefined
	vi.resetModules()
	vi.doUnmock(KIT)
})

async function render(kit: Record<string, unknown>) {
	vi.doMock(KIT, () => kit)
	const page = (await import('@/pages/DataImport.vue')).default
	wrapper = mount(page)
	return wrapper.text()
}

describe('data import page', () => {
	it('shows the wizard when frappe ships it', async () => {
		expect(await render(WIZARD_KIT())).toBe('WizardFlow')
	})

	it('lists saved imports on the list route, which the wizard has no view for', async () => {
		route.name = 'DataImportList'
		expect(await render(WIZARD_KIT())).toBe('ImportList')
	})

	it('leaves the list to the one-page import, which lists imports itself', async () => {
		route.name = 'DataImportList'
		expect(await render({ DataImport: stub('DataImport') })).toBe('LegacyFlow')
	})

	it('shows the one-page import on frappe that has only that', async () => {
		const text = await render({ DataImport: stub('DataImport') })
		expect(text).toBe('LegacyFlow')
	})

	it('reports the one-page import when the wizard is missing', async () => {
		vi.doMock(KIT, () => ({ DataImport: stub('DataImport') }))
		const kit = await import('@/utils/frameworkDataImport')
		expect(kit.hasDataImportWizard).toBe(false)
		expect(kit.LegacyDataImport).toBeTruthy()
		expect(kit.DataImportWizard).toBeUndefined()
	})
})
