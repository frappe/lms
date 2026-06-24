import type {
	API,
	BlockAPI,
	BlockToolData,
	BlockTune,
	TunesMenuConfig,
} from '@editorjs/editorjs'
// EditorJS popover takes icons as HTML strings, so use lucide-static raw SVGs
// (the lucide-vue-next components can't render here).
import scissorsIcon from 'lucide-static/icons/scissors.svg?raw'
import copyIcon from 'lucide-static/icons/copy.svg?raw'
import clipboardIcon from 'lucide-static/icons/clipboard-paste.svg?raw'

/**
 * Cut / Copy / Paste block tunes for EditorJS 2.29.0, plus a keyboard handler
 * that runs the same actions on a block selection without touching the
 * browser's native text cut/copy/paste.
 *
 * Block payloads are structured tool data (a quiz, an embed, a table), not
 * text/HTML, so they can't round-trip through the OS clipboard — the buffer
 * below is an in-app clipboard scoped to the single mounted editor instance.
 *
 * Ref: EditorJS Block Tunes API (https://editorjs.dev/docs/tools/block-tunes),
 * TunesMenuConfig / PopoverItem (types/tools/tool-settings.d.ts).
 */

interface CopiedBlock {
	tool: string
	data: BlockToolData
}

let blockClipboard: CopiedBlock | null = null

// navigator.platform is deprecated; prefer User-Agent Client Hints, falling
// back to the UA string where they're unavailable.
const platformHint =
	(navigator as Navigator & { userAgentData?: { platform?: string } })
		.userAgentData?.platform ?? navigator.userAgent
const isMac = /(Mac|iPhone|iPad)/i.test(platformHint)

// Beautified for display only, mirroring EditorJS's own shortcut formatting.
function shortcutLabel(key: string): string {
	return isMac ? `⌘${key}` : `Ctrl ${key}`
}

interface TuneConstructorOptions {
	api: API
	block: BlockAPI
}

async function copyBlockToBuffer(block: BlockAPI): Promise<void> {
	const saved = await block.save()
	if (!saved) return
	blockClipboard = { tool: saved.tool, data: saved.data }
}

async function copyBlock(block: BlockAPI): Promise<void> {
	await copyBlockToBuffer(block)
}

async function cutBlock(api: API, block: BlockAPI): Promise<void> {
	await copyBlockToBuffer(block)
	const index = api.blocks.getCurrentBlockIndex()
	if (index < 0) return
	api.blocks.delete(index)
}

function pasteBlock(api: API): void {
	if (!blockClipboard) return
	const index = api.blocks.getCurrentBlockIndex()
	const at = index < 0 ? api.blocks.getBlocksCount() : index + 1
	api.blocks.insert(blockClipboard.tool, blockClipboard.data, {}, at, true)
}

class CopyTune implements BlockTune {
	static get isTune(): boolean {
		return true
	}

	private readonly api: API
	private readonly block: BlockAPI

	constructor({ api, block }: TuneConstructorOptions) {
		this.api = api
		this.block = block
	}

	render(): TunesMenuConfig {
		return {
			icon: copyIcon,
			title: __('Copy'),
			secondaryLabel: shortcutLabel('C'),
			name: 'copy-block',
			onActivate: (): void => {
				copyBlock(this.block)
			},
		}
	}
}

class CutTune implements BlockTune {
	static get isTune(): boolean {
		return true
	}

	private readonly api: API
	private readonly block: BlockAPI

	constructor({ api, block }: TuneConstructorOptions) {
		this.api = api
		this.block = block
	}

	render(): TunesMenuConfig {
		return {
			icon: scissorsIcon,
			title: __('Cut'),
			secondaryLabel: shortcutLabel('X'),
			name: 'cut-block',
			onActivate: (): void => {
				cutBlock(this.api, this.block)
			},
		}
	}
}

class PasteTune implements BlockTune {
	static get isTune(): boolean {
		return true
	}

	private readonly api: API

	constructor({ api }: TuneConstructorOptions) {
		this.api = api
	}

	render(): TunesMenuConfig {
		return {
			icon: clipboardIcon,
			title: __('Paste'),
			secondaryLabel: shortcutLabel('V'),
			name: 'paste-block',
			// render() is called by BlockSettings.open() every time the block's
			// tunes menu opens, so this re-reads the current clipboard each time —
			// the item enables once a block has been copied. pasteBlock() also
			// guards on an empty clipboard.
			isDisabled: blockClipboard === null,
			onActivate: (): void => {
				pasteBlock(this.api)
			},
		}
	}
}

export const clipboardTunes = {
	copyBlock: CopyTune,
	cutBlock: CutTune,
	pasteBlock: PasteTune,
}

// Names registered in getEditorTools(); fed to the editor's global `tunes`.
export const clipboardTuneNames: readonly string[] = [
	'copyBlock',
	'cutBlock',
	'pasteBlock',
]

function hasTextSelection(): boolean {
	const selection = window.getSelection()
	return selection !== null && !selection.isCollapsed && selection.toString() !== ''
}

function hasSelectedBlock(api: API): boolean {
	const count = api.blocks.getBlocksCount()
	for (let index = 0; index < count; index++) {
		if (api.blocks.getBlockByIndex(index)?.selected) return true
	}
	return false
}

/**
 * Keydown handler for cut/copy/paste that acts ONLY on an EditorJS block
 * selection. When the user has a normal text selection inside a block, it does
 * nothing so the browser's native clipboard behaviour wins. Returns true when
 * it handled the event (caller should not do anything further).
 */
export function handleBlockClipboardShortcut(api: API, event: KeyboardEvent): boolean {
	const modifier = isMac ? event.metaKey : event.ctrlKey
	if (!modifier || event.altKey) return false

	const key = event.key.toLowerCase()
	if (key !== 'c' && key !== 'x' && key !== 'v') return false

	// A real text selection means the user wants native copy/cut — stay out.
	if (key !== 'v' && hasTextSelection()) return false
	// Paste with a collapsed caret and no selected block is native text paste.
	if (!hasSelectedBlock(api)) return false

	event.preventDefault()
	const currentIndex = api.blocks.getCurrentBlockIndex()
	const block = currentIndex >= 0 ? api.blocks.getBlockByIndex(currentIndex) : undefined

	if (key === 'c' && block) {
		copyBlock(block)
	} else if (key === 'x' && block) {
		cutBlock(api, block)
	} else if (key === 'v') {
		pasteBlock(api)
	}
	return true
}
