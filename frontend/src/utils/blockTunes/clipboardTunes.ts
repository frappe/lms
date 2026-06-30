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
 * Cut / Copy / Paste block tunes (settings-menu items) for EditorJS 2.29.0.
 * Block payloads are structured tool data, not text/HTML, so they can't use the
 * OS clipboard; the buffer below is an in-app clipboard scoped to one editor.
 */

interface CopiedBlock {
	tool: string
	data: BlockToolData
}

let blockClipboard: CopiedBlock | null = null

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
			name: 'paste-block',
			// Re-evaluated each time the tunes menu opens, so it reflects the
			// current clipboard; enables once a block has been copied.
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
