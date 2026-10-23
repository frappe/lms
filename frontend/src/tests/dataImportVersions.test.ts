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

let wrapper: VueWrapper | undefined

afterEach(() => {
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
		const text = await render({ DataImportWizard: stub('DataImportWizard'), useDataImport: () => ({}) })
		expect(text).toBe('WizardFlow')
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
