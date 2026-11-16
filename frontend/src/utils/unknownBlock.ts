import type { BlockToolData, OutputBlockData } from '@editorjs/editorjs'

type StubData = { savedData: OutputBlockData }

// Replaces EditorJS's stub tool, which shows the raw type name of a block no
// tool is registered for. save() hands back the original block untouched.
export class UnknownBlock {
	static isReadOnlySupported = true
	savedData: OutputBlockData

	constructor({ data }: { data: StubData }) {
		this.savedData = data.savedData
	}

	render(): HTMLElement {
		const wrapper = document.createElement('div')
		wrapper.className =
			'not-prose flex items-center gap-3 rounded-6 bg-surface-gray-2 p-3'
		const icon = document.createElement('span')
		icon.className = 'lucide-circle-alert size-4 shrink-0 text-ink-gray-6'
		icon.setAttribute('aria-hidden', 'true')
		const text = document.createElement('span')
		text.className = 'text-p-sm text-ink-gray-7'
		text.textContent = __('This content is not available')
		wrapper.append(icon, text)
		return wrapper
	}

	save(): BlockToolData {
		return this.savedData
	}
}
