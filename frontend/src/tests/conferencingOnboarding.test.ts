/**
 * Linking a Zoom or Google Meet account completes the live-class flow's
 * "connect conferencing" step; editing an existing account does not.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FieldsPage } from '@/types/settingsSchema'

const { completeStepMock } = vi.hoisted(() => ({ completeStepMock: vi.fn() }))

vi.mock('frappe-ui', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({ completeStep: completeStepMock }),
}))
vi.mock('@/utils', () => ({ openSettings: vi.fn() }))
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: { data: null } }),
}))
vi.mock('@/components/Settings/rowActions', () => ({
	deleteRow: () => vi.fn(),
	setRowField: () => vi.fn(),
	toggleRowField: () => vi.fn(),
}))

import { zoomSettingsPage } from '@/components/Settings/Zoom/zoom'
import { googleMeetSettingsPage } from '@/components/Settings/GoogleMeet/googleMeet'

const pages = [
	{ name: 'Zoom', page: zoomSettingsPage },
	{ name: 'Google Meet', page: googleMeetSettingsPage },
]

function onSaved(page: typeof pages[number]['page']) {
	const detail = page.create?.detail as FieldsPage
	return detail.onSaved!
}

beforeEach(() => completeStepMock.mockReset())

describe('conferencing account onboarding', () => {
	it.each(pages)('$name: linking an account completes the step', ({ page }) => {
		onSaved(page)({ created: true, back: vi.fn() } as never)
		expect(completeStepMock).toHaveBeenCalledWith('connect_conferencing')
	})

	// Guards: an edit to an existing account ticking the step. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to
	// cover the edit path.
	it.each(pages)('$name: editing an account leaves it alone', ({ page }) => {
		onSaved(page)({ created: false, back: vi.fn() } as never)
		expect(completeStepMock).not.toHaveBeenCalled()
	})
})
