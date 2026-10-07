// Onboarding must use the sidebar nav label class and ghost buttons only, bar
// the banner's Start now/Continue (framework blue). Reads the sources, so a
// change on either side shows up here.
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ROW_TEXT } from '@/onboarding/rowClasses'

// vitest runs from frontend/, so resolve from the working directory.
const SRC = resolve(process.cwd(), 'src')
const SIDEBAR_LINK = join(SRC, 'components/Sidebar/SidebarLink.vue')
const ONBOARDING = join(SRC, 'components/Onboarding')

const onboardingFiles = () =>
	readdirSync(ONBOARDING)
		.filter((name) => name.endsWith('.vue'))
		.map((name) => ({
			name,
			source: readFileSync(join(ONBOARDING, name), 'utf8'),
		}))

describe('onboarding matches the sidebar', () => {
	// Guards: the it.each checks passing on zero files after a path move.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to fail loudly if the sources go missing.
	it('finds the sources it checks', () => {
		expect(existsSync(SIDEBAR_LINK)).toBe(true)
		expect(onboardingFiles().length).toBeGreaterThanOrEqual(4)
	})

	// Guards: ROW_TEXT drifting from SidebarLink's label class. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to tie
	// the onboarding text to the sidebar.
	it("uses the sidebar nav label's text class", () => {
		const source = readFileSync(SIDEBAR_LINK, 'utf8')
		const label = source.match(/<span class="truncate (text-[\w-]+)">/)
		expect(label?.[1]).toBe(ROW_TEXT)
	})

	// Guards: an onboarding component using a text size other than the sidebar's.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check every component source.
	it.each(onboardingFiles().map(({ name }) => ({ name })))(
		'$name uses no other text size',
		({ name }) => {
			const source = readFileSync(join(ONBOARDING, name), 'utf8')
			const sizes =
				source.match(/\btext-(?:p-)?(?:2xs|xs|sm|base|md|lg|xl)\b/g) ?? []
			expect(new Set(sizes)).toEqual(new Set(sizes.length ? [ROW_TEXT] : []))
		}
	)

	// Guards: solid or themed onboarding buttons, or Start now losing its blue
	// accent. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to check every Button.
	it.each(onboardingFiles().map(({ name }) => ({ name })))(
		'$name has only ghost buttons',
		({ name }) => {
			const source = readFileSync(join(ONBOARDING, name), 'utf8')
			expect(source).not.toMatch(/variant="(?:solid|subtle|outline)"/)
			const buttons = source.match(/<Button\b[^>]*>/gs) ?? []
			for (const button of buttons) {
				if (name === 'OnboardingBanner.vue' && /text\.start/.test(button)) {
					expect(button).toMatch(/\btheme="blue"/)
					expect(button).not.toMatch(/\bvariant="/)
					continue
				}
				expect(button).toMatch(/variant="ghost"/)
				expect(button).not.toMatch(/\btheme="/)
			}
		}
	)
})
