/**
 * Chrome for `RichTextEditor.vue`. Every class here is a literal so Tailwind's
 * JIT emits it; a height or variant that is not a key below has no CSS.
 */

export type RichTextEditorVariant = 'outline' | 'subtle' | 'ghost' | 'inline'

const BOX: Record<RichTextEditorVariant, { valid: string; invalid: string }> = {
	outline: {
		valid:
			'rounded-5 border border-outline-gray-2 bg-surface-base transition-colors hover:border-outline-gray-3 hover:shadow-sm focus-within:border-outline-gray-4 focus-within:shadow-sm',
		invalid:
			'rounded-5 border border-outline-red-3 bg-surface-base transition-colors hover:shadow-sm focus-within:border-outline-red-4 focus-within:shadow-sm',
	},
	subtle: {
		valid:
			'rounded-5 border border-[--surface-gray-2] bg-surface-gray-2 transition-colors hover:border-outline-elevation-2 hover:bg-surface-gray-3 focus-within:border-outline-gray-4 focus-within:bg-surface-base focus-within:shadow-sm',
		invalid:
			'rounded-5 border border-outline-red-3 bg-surface-gray-2 transition-colors hover:bg-surface-gray-3 focus-within:border-outline-red-4 focus-within:bg-surface-base focus-within:shadow-sm',
	},
	ghost: { valid: '', invalid: '' },
	// No border until the editor has focus, for text edited in place.
	inline: {
		valid:
			'rounded-5 border border-transparent transition-colors hover:bg-surface-gray-2 focus-within:border-outline-gray-4 focus-within:bg-surface-base focus-within:shadow-sm',
		invalid:
			'rounded-5 border border-outline-red-3 transition-colors focus-within:border-outline-red-4 focus-within:shadow-sm',
	},
}

// Sticks to the top while scrolling a long body; shows only while focused.
const FOCUS_TOOLBAR =
	'sticky top-0 z-[1] hidden flex-wrap rounded-t-5 border-b border-outline-gray-1 bg-surface-base px-2 py-1.5 group-focus-within/editor:flex has-[[data-state=open]]:flex'

const ROOMY_CONTENT = 'px-3 py-2.5'

const TOOLBAR: Record<RichTextEditorVariant, string> = {
	outline: 'flex-wrap border-b border-outline-gray-2 p-1',
	subtle: 'flex-wrap border-b border-outline-gray-2 p-1',
	ghost: 'flex-wrap pb-1',
	inline: 'flex-wrap border-b border-outline-gray-2 p-1',
}

// Outline and subtle boxes show focus on their own border; a ghost editor has
// no box, so its content carries the focus ring.
const CONTENT: Record<RichTextEditorVariant, string> = {
	outline: 'px-2 py-1',
	subtle: 'px-2 py-1',
	ghost: 'focus-visible:ring-2 focus-visible:ring-outline-gray-5',
	inline: 'px-2 py-1',
}

export const MIN_HEIGHT = {
	'5rem': 'min-h-[5rem]',
	'8rem': 'min-h-[8rem]',
	'6rem': 'min-h-[6rem]',
	'7rem': 'min-h-[7rem]',
	'10rem': 'min-h-[10rem]',
	'12rem': 'min-h-[12rem]',
	'20rem': 'min-h-[20rem]',
	'200px': 'min-h-[200px]',
	'280px': 'min-h-[280px]',
} as const

export const MAX_HEIGHT = {
	'13rem': 'max-h-[13rem] overflow-y-auto',
	'14rem': 'max-h-[14rem] overflow-y-auto',
	'16rem': 'max-h-[16rem] overflow-y-auto',
	'17rem': 'max-h-[17rem] overflow-y-auto',
	'18rem': 'max-h-[18rem] overflow-y-auto',
	'70vh': 'max-h-[70vh] overflow-y-auto',
} as const

export type RichTextEditorMinHeight = keyof typeof MIN_HEIGHT
export type RichTextEditorMaxHeight = keyof typeof MAX_HEIGHT

export function boxClass(
	variant: RichTextEditorVariant,
	invalid: boolean,
	fill: boolean
): string[] {
	const state = BOX[variant]
	return [
		invalid ? state.invalid : state.valid,
		fill ? 'flex flex-1 flex-col' : '',
	]
}

export function toolbarClass(
	variant: RichTextEditorVariant,
	onFocus = false
): string {
	return onFocus ? FOCUS_TOOLBAR : TOOLBAR[variant]
}

export function contentClass(
	variant: RichTextEditorVariant,
	minHeight: RichTextEditorMinHeight | null,
	maxHeight: RichTextEditorMaxHeight | null,
	fill: boolean,
	roomy = false
): string[] {
	return [
		roomy && variant !== 'ghost' ? ROOMY_CONTENT : CONTENT[variant],
		minHeight ? MIN_HEIGHT[minHeight] : '',
		maxHeight ? MAX_HEIGHT[maxHeight] : '',
		fill ? 'flex-1 overflow-y-auto' : '',
	]
}
