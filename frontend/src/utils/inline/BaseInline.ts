import { ToolButton } from './ToolButton'

interface TextPart {
	node: Text
	start: number
	end: number
}

/** One wrapper's plan, measured before anything moves. `head` and `tail` are the
 * parts falling outside the selection, and point only inside that wrapper. */
interface UnwrapPlan {
	wrapper: HTMLElement
	head: Range | null
	tail: Range | null
}

/**
 * Wraps and unwraps the selection in `this.tag` through the Range API, not
 * `execCommand`. Both halves honour the user's range: the automad port this came
 * from only honoured it when wrapping, which lost text across list items.
 */
export abstract class BaseInline extends ToolButton {
	protected abstract get tag(): string

	surround(range: Range): void {
		if (!range || range.collapsed) {
			return
		}
		if (this.state) {
			this.unwrap(range)
		} else {
			this.wrap(range)
		}
	}

	wrap(range: Range): void {
		const parts = this.textPartsIn(range).filter(
			(part): boolean => this.wrapperOf(part.node) === null
		)
		if (!parts.length) {
			return
		}
		// One wrapper per run. Extracting the whole range into a single element
		// would drag any block elements it spans (list items, table cells) inside
		// an inline tag.
		const wrappers = parts.map((part): HTMLElement => this.wrapPart(part))
		// Merge, or a partly-formatted selection is left as N siblings, which
		// `save()` persists and every later edit adds to.
		this.parentsOf(wrappers).forEach((parent): void => {
			this.mergeAdjacent(parent)
		})
		this.selectWrapped(wrappers)
	}

	/** Put the selection back across the run that was just wrapped. */
	private selectWrapped(wrappers: HTMLElement[]): void {
		// A wrapper the merge absorbed is out of the document, and the one that
		// absorbed it now spans its text.
		const live = wrappers.filter((node): boolean => node.isConnected)
		const selection = window.getSelection()
		if (!selection || !live.length) {
			return
		}
		const next = document.createRange()
		next.setStartBefore(live[0])
		next.setEndAfter(live[live.length - 1])
		selection.removeAllRanges()
		selection.addRange(next)
	}

	unwrap(range: Range): void {
		// Measure every boundary before touching the DOM: removing a node collapses
		// any live range whose boundary sits inside it, so `range` is unusable once
		// the first wrapper has gone.
		const plans = this.wrappersIn(range).map(
			(wrapper): UnwrapPlan => this.planUnwrap(wrapper, range)
		)
		const parents = this.parentsOf(
			plans.map((plan): HTMLElement => plan.wrapper)
		)
		// Later ones first, so extracting from one wrapper cannot shift the
		// boundaries still pending in the wrappers before it.
		for (const plan of plans.reverse()) {
			this.applyUnwrap(plan)
		}
		// Merge last. Mid-loop it can absorb a wrapper whose plan has not run yet.
		parents.forEach((parent): void => {
			this.mergeAdjacent(parent)
		})
	}

	checkState(): boolean {
		const selection = window.getSelection()
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null
		// "On" means every character is already formatted. Reading the boundary
		// ancestors alone reported false for a run inside the selection, so the
		// next press nested tags.
		this.state =
			range && !range.collapsed
				? this.isFullyWrapped(range)
				: this.findWrapper() !== null
		return this.state
	}

	private get selector(): string {
		return this.tag.toLowerCase()
	}

	private findWrapper(): HTMLElement | null {
		return this.api.selection.findParentTag(this.tag)
	}

	private wrapperOf(node: Node): HTMLElement | null {
		const element =
			node.nodeType === Node.ELEMENT_NODE
				? (node as Element)
				: node.parentElement
		return element?.closest<HTMLElement>(this.selector) ?? null
	}

	/** Every text run the range actually covers, clipped to the range. */
	private textPartsIn(range: Range): TextPart[] {
		const root = range.commonAncestorContainer
		const scope =
			root.nodeType === Node.TEXT_NODE ? (root.parentNode as Node) : root
		const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
		const parts: TextPart[] = []
		let node: Node | null
		while ((node = walker.nextNode())) {
			const text = node as Text
			if (!range.intersectsNode(text)) {
				continue
			}
			const start = text === range.startContainer ? range.startOffset : 0
			const end = text === range.endContainer ? range.endOffset : text.length
			if (end > start) {
				parts.push({ node: text, start, end })
			}
		}
		return parts
	}

	private wrapPart(part: TextPart): HTMLElement {
		let text = part.node
		if (part.end < text.length) {
			text.splitText(part.end)
		}
		if (part.start > 0) {
			text = text.splitText(part.start)
		}
		const node = document.createElement(this.tag)
		text.parentNode?.insertBefore(node, text)
		node.appendChild(text)
		return node
	}

	private isFullyWrapped(range: Range): boolean {
		const parts = this.textPartsIn(range)
		if (!parts.length) {
			return this.findWrapper() !== null
		}
		return parts.every((part): boolean => this.wrapperOf(part.node) !== null)
	}

	private wrappersIn(range: Range): HTMLElement[] {
		const found = new Set<HTMLElement>()
		for (const boundary of [range.startContainer, range.endContainer]) {
			const wrapper = this.wrapperOf(boundary)
			if (wrapper) {
				found.add(wrapper)
			}
		}
		const root = range.commonAncestorContainer
		const scope =
			root.nodeType === Node.ELEMENT_NODE
				? (root as Element)
				: root.parentElement
		scope?.querySelectorAll<HTMLElement>(this.selector).forEach((el): void => {
			if (range.intersectsNode(el)) {
				found.add(el)
			}
		})
		return [...found].sort((a, b): number =>
			a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
		)
	}

	/** Which parts of `wrapper` fall outside the selection. Measurement only: every
	 * plan is built against the document as it stands before any of them run. */
	private planUnwrap(wrapper: HTMLElement, range: Range): UnwrapPlan {
		const full = document.createRange()
		full.selectNodeContents(wrapper)
		const coversStart =
			range.compareBoundaryPoints(Range.START_TO_START, full) <= 0
		const coversEnd = range.compareBoundaryPoints(Range.END_TO_END, full) >= 0

		let head: Range | null = null
		if (!coversStart) {
			head = document.createRange()
			head.setStart(full.startContainer, full.startOffset)
			head.setEnd(range.startContainer, range.startOffset)
		}
		let tail: Range | null = null
		if (!coversEnd) {
			tail = document.createRange()
			tail.setStart(range.endContainer, range.endOffset)
			tail.setEnd(full.endContainer, full.endOffset)
		}
		return { wrapper, head, tail }
	}

	/** Strip the formatting from the part of the wrapper the selection covers. */
	private applyUnwrap({ wrapper, head, tail }: UnwrapPlan): void {
		// Tail before head: extracting the head shifts everything after it.
		if (tail) {
			this.reinsert(wrapper, tail, 'after')
		}
		if (head) {
			this.reinsert(wrapper, head, 'before')
		}
		wrapper.replaceWith(...Array.from(wrapper.childNodes))
	}

	/** The distinct parents of the given wrappers, read before anything moves. */
	private parentsOf(wrappers: HTMLElement[]): Set<Node> {
		const parents = new Set<Node>()
		for (const wrapper of wrappers) {
			if (wrapper.parentNode) {
				parents.add(wrapper.parentNode)
			}
		}
		return parents
	}

	/**
	 * Re-wrap the part of a run left outside the selection. Empty means no nodes,
	 * not no text: `extractContents` has already detached the remainder, so
	 * bailing on `textContent` deleted a lone `<br>` or `<img>`.
	 */
	private reinsert(
		wrapper: HTMLElement,
		remainder: Range,
		side: 'before' | 'after'
	): void {
		const contents = remainder.extractContents()
		if (!contents.textContent && !contents.querySelector('*')) {
			return
		}
		const node = wrapper.cloneNode(false) as HTMLElement
		node.appendChild(contents)
		wrapper[side](node)
	}

	/** Keep repeated edits from growing a chain of identical adjacent tags. */
	private mergeAdjacent(parent: Node | null): void {
		if (!parent) {
			return
		}
		for (const child of Array.from(parent.childNodes)) {
			if (child instanceof HTMLElement && child.matches(this.selector)) {
				this.absorbFollowing(child)
			}
		}
	}

	/** Pull every identical sibling that follows `wrapper` into it. */
	private absorbFollowing(wrapper: HTMLElement): void {
		let next = wrapper.nextSibling
		while (
			next instanceof HTMLElement &&
			next.matches(this.selector) &&
			next.getAttribute('style') === wrapper.getAttribute('style')
		) {
			while (next.firstChild) {
				wrapper.appendChild(next.firstChild)
			}
			const after = next.nextSibling
			next.remove()
			next = after
		}
		wrapper.normalize()
	}
}
