import { BaseInline } from './BaseInline'
import { boldIcon } from './icons'

/**
 * Replaces EditorJS's built-in Bold, which calls `document.execCommand('bold')`.
 * Inside a heading the text is already bold, so the browser reads the command as
 * already-on and *un*-bolds: it writes `<span style="font-weight: normal">`,
 * which the block sanitizer then drops. Wrapping the range in `<b>` ourselves
 * works the same in every block, heading or not.
 *
 * Registering it under the `bold` name overrides the internal tool — EditorJS
 * merges user tools over `internalTools`. The name stays `bold` so the shared
 * inline-toolbar order and existing `<b>` content keep working.
 */
export class Bold extends BaseInline {
	static get title(): string {
		return __('Bold')
	}

	static get sanitize(): Record<string, boolean> {
		return { b: true }
	}

	static get shortcut(): string {
		return 'CMD+B'
	}

	// EditorJS reads the shortcut off the *instance* for tools registered under
	// an internal name (InlineToolbar.getToolShortcut), so the static getter
	// alone would leave Ctrl+B unbound.
	get shortcut(): string {
		return 'CMD+B'
	}

	protected get tag(): string {
		return 'B'
	}

	protected get icon(): string {
		return boldIcon
	}
}
