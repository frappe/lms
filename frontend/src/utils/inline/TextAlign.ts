import { ToolButton } from './ToolButton'
import { alignLeftIcon, alignCenterIcon, alignRightIcon } from './icons'

type AlignOption = 'left' | 'center' | 'right'

interface AlignSelection {
	start: number
	end: number
	host: HTMLElement | null
}

const ALIGN_CLASS = 'lms-align'

/** The largest valid offset in a node: characters for text, children otherwise. */
const offsetLimit = (node: Node): number =>
	node.nodeType === Node.TEXT_NODE
		? (node as Text).length
		: node.childNodes.length

/**
 * Wraps the whole block in one `<span class="lms-align">` carrying `text-align`.
 * It was a custom `<lms-align>` element, which no save survived: nh3 and
 * DOMPurify both allowlist by tag name and unwrap anything they do not know.
 */
abstract class BaseTextAlign extends ToolButton {
	static get sanitize(): Record<string, unknown> {
		return { span: { class: true, style: true } }
	}

	protected abstract get align(): AlignOption

	private readonly tag = 'SPAN'
	private selection: AlignSelection | null = null

	surround(): void {
		this.saveSelection()
		if (this.state) {
			this.removeWrapper()
		} else {
			const node = this.findWrapper() ?? this.createWrapper()
			if (node) {
				node.style.textAlign = this.align
				node.style.display = 'block'
			}
		}
		this.restoreSelection()
	}

	checkState(): boolean {
		const node = this.findWrapper()
		this.state = node !== null && node.style.textAlign === this.align
		return this.state
	}

	private findWrapper(): HTMLElement | null {
		return this.api.selection.findParentTag(this.tag, ALIGN_CLASS)
	}

	/** The block's own editable root. `findParentTag('DIV')` escaped the
	 * contenteditable on a heading and wrapped the `<h2>` itself. */
	private get host(): HTMLElement | null {
		const selection = window.getSelection()
		const node = selection?.anchorNode
		if (!node) {
			return null
		}
		const element =
			node.nodeType === Node.ELEMENT_NODE
				? (node as HTMLElement)
				: node.parentElement
		return element?.closest<HTMLElement>('[contenteditable="true"]') ?? null
	}

	private removeWrapper(): void {
		const node = this.findWrapper()
		if (!node) {
			return
		}
		this.api.selection.expandToTag(node)
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) {
			return
		}
		const range = selection.getRangeAt(0)
		const contents = range.extractContents()
		node.remove()
		range.insertNode(contents)
	}

	private createWrapper(): HTMLElement | null {
		const host = this.host
		if (!host) {
			return null
		}
		const range = document.createRange()
		range.selectNodeContents(host)
		const node = document.createElement(this.tag)
		node.classList.add(ALIGN_CLASS)
		node.appendChild(range.extractContents())
		range.insertNode(node)
		return node
	}

	private saveSelection(): void {
		const selection = window.getSelection()
		this.selection = {
			start: selection ? selection.anchorOffset : 0,
			end: selection ? selection.focusOffset : 0,
			host: this.host,
		}
	}

	/** Offsets are saved against the caret's node but restored against the
	 * wrapper's first child, a different node after the rewrap. Unclamped that
	 * throws IndexSizeError whenever the caret sat inside a formatted run. */
	private restoreSelection(): void {
		const selection = window.getSelection()
		const anchor = this.anchorNode()
		if (!selection || !this.selection || !anchor) {
			return
		}
		const limit = offsetLimit(anchor)
		selection.removeAllRanges()
		selection.setBaseAndExtent(
			anchor,
			Math.min(this.selection.start, limit),
			anchor,
			Math.min(this.selection.end, limit)
		)
	}

	/** Where the caret goes back: into the wrapper if there is one, else the host. */
	private anchorNode(): ChildNode | null {
		const host = this.selection?.host
		if (!host) {
			return null
		}
		const wrapper = host.querySelector<HTMLElement>(
			`:scope > ${this.tag.toLowerCase()}.${ALIGN_CLASS}`
		)
		return (wrapper ?? host).firstChild
	}
}

export class AlignLeft extends BaseTextAlign {
	static get title(): string {
		return __('Align left')
	}

	protected get align(): AlignOption {
		return 'left'
	}

	protected get icon(): string {
		return alignLeftIcon
	}
}

export class AlignCenter extends BaseTextAlign {
	static get title(): string {
		return __('Align center')
	}

	protected get align(): AlignOption {
		return 'center'
	}

	protected get icon(): string {
		return alignCenterIcon
	}
}

export class AlignRight extends BaseTextAlign {
	static get title(): string {
		return __('Align right')
	}

	protected get align(): AlignOption {
		return 'right'
	}

	protected get icon(): string {
		return alignRightIcon
	}
}
