// Guards the shared card shell and header every assessment block renders in.
// Came with this branch's shared AssessmentCard/AssessmentCardHeader change.
// Added on feat/assessment-visual-redesign to pin the header's props contract.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AssessmentCard from '@/components/Assessment/AssessmentCard.vue'
import AssessmentCardHeader from '@/components/Assessment/AssessmentCardHeader.vue'

// Per-mount `__` mock: setup.ts's stubGlobal misses a compiled template's
// `_ctx.__`. Mirrors setup.ts's translate() contract.
const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, index) =>
				args[Number(index)] === undefined ? match : String(args[Number(index)])
			),
	}
}

describe('AssessmentCard', () => {
	it('renders its slot content inside a bordered shell', () => {
		const wrapper = mount(AssessmentCard, {
			slots: { default: '<p data-testid="body">hi</p>' },
		})
		expect(wrapper.classes()).toContain('border')
		expect(wrapper.find('[data-testid="body"]').exists()).toBe(true)
	})

	it('merges a caller class onto the root element', () => {
		const wrapper = mount(AssessmentCard, {
			attrs: { class: 'flex h-full' },
		})
		expect(wrapper.classes()).toContain('flex')
		expect(wrapper.classes()).toContain('h-full')
		expect(wrapper.classes()).toContain('border')
	})
})

describe('AssessmentCardHeader', () => {
	const mountHeader = (props: Record<string, unknown>) =>
		mount(AssessmentCardHeader, {
			props,
			slots: { default: '<button data-testid="action">Run</button>' },
			global: { mocks: { __: translate } },
		})

	it('renders icon, title, and subtitle joined by a separator', () => {
		const wrapper = mountHeader({
			icon: 'lucide-code-xml',
			title: 'Coding exercise',
			subtitle: 'Python',
		})
		expect(wrapper.find('.lucide-code-xml').exists()).toBe(true)
		expect(wrapper.text()).toContain('Coding exercise')
		expect(wrapper.find('[data-testid="header-separator"]').exists()).toBe(true)
		expect(wrapper.text()).toContain('Python')
	})

	it('omits the separator when there is no subtitle', () => {
		const wrapper = mountHeader({ icon: 'lucide-file', title: 'Assignment' })
		expect(wrapper.find('[data-testid="header-separator"]').exists()).toBe(
			false
		)
	})

	it('shows a Preview only badge only when preview is true', () => {
		expect(
			mountHeader({
				icon: 'lucide-file',
				title: 'Assignment',
				preview: true,
			}).text()
		).toContain('Preview only')
		expect(
			mountHeader({
				icon: 'lucide-file',
				title: 'Assignment',
				preview: false,
			}).text()
		).not.toContain('Preview only')
	})

	it('renders the actions slot', () => {
		expect(
			mountHeader({ icon: 'lucide-file', title: 'Assignment' })
				.find('[data-testid="action"]')
				.exists()
		).toBe(true)
	})

	// Guards the header's actions overlapping the title on a phone.
	// Came with this branch's shared AssessmentCardHeader change.
	// Added on feat/assessment-visual-redesign; jsdom has no layout, so classes.
	it('truncates the heading and wraps the actions instead of overlapping', () => {
		const wrapper = mountHeader({
			icon: 'lucide-file',
			title: 'Programming Exercise',
			subtitle: 'A long exercise title',
			preview: true,
		})
		const root = wrapper.get('[data-testid="assessment-card-header"]')
		expect(root.classes()).toEqual(
			expect.arrayContaining(['flex-wrap', 'min-h-11'])
		)
		const heading = wrapper.get('[data-testid="header-heading"]')
		expect(heading.classes()).toEqual(
			expect.arrayContaining(['min-w-0', 'grow', 'basis-48'])
		)
		expect(heading.get('h2').classes()).toContain('truncate')
		expect(heading.findAll('span').at(-1)!.classes()).toEqual(
			expect.arrayContaining(['min-w-0', 'truncate'])
		)
		const actions = wrapper.get('[data-testid="header-actions"]')
		expect(actions.classes()).toEqual(
			expect.arrayContaining(['ms-auto', 'shrink-0'])
		)
		expect(actions.text()).toContain('Preview only')
		expect(actions.find('.whitespace-nowrap').exists()).toBe(true)
	})
})
