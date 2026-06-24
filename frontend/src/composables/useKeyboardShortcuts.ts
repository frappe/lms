import { onBeforeUnmount, onMounted, unref } from 'vue'
import type { Ref } from 'vue'
// @ts-expect-error utils/dialogs.js has no type declarations yet
import { isDialogOpen } from '@/utils/dialogs'

// Ported from apps/crm/frontend/src/composables/useKeyboardShortcuts.js
// (typed for LMS). A shortcut is matched either by `keys` (KeyboardEvent.key,
// one or many) or by a custom `match` predicate.

type ShortcutAction = (e: KeyboardEvent) => void

interface ShortcutDef {
	keys?: string | string[]
	match?: (e: KeyboardEvent) => boolean
	guard?: (e: KeyboardEvent) => boolean
	action: ShortcutAction
	preventDefault?: boolean
	stopPropagation?: boolean
}

interface KeyboardShortcutsOptions {
	active?: boolean | Ref<boolean> | (() => boolean)
	shortcuts: readonly ShortcutDef[]
	ignoreTyping?: boolean
	target?: EventTarget | null
	skipWhenDialogOpen?: boolean
}

interface KeyboardShortcutsHandle {
	stop: () => void
}

function isTypingEvent(e: KeyboardEvent): boolean {
	const el = e.target as HTMLElement | null
	if (!el) return false
	const tag = el.tagName
	return (
		el.isContentEditable ||
		tag === 'INPUT' ||
		tag === 'TEXTAREA' ||
		tag === 'SELECT' ||
		Boolean(el.closest?.('[contenteditable="true"]')) ||
		// LMS rich-text editors (Tiptap/EditorJS) expose a ProseMirror surface
		// that isn't always reported as contenteditable on the event target.
		Boolean(el.closest?.('.ProseMirror'))
	)
}

function matchShortcut(def: ShortcutDef, e: KeyboardEvent): boolean {
	if (def.match) return def.match(e)
	if (!def.keys) return false
	const keys = Array.isArray(def.keys) ? def.keys : [def.keys]
	return keys.some((k) => k === e.key)
}

export function useKeyboardShortcuts(
	options: KeyboardShortcutsOptions
): KeyboardShortcutsHandle {
	const {
		active = true,
		shortcuts,
		ignoreTyping = true,
		target = typeof window !== 'undefined' ? window : null,
		skipWhenDialogOpen = true,
	} = options

	const handler = (e: KeyboardEvent): void => {
		if (!target) return
		const isActive = typeof active === 'function' ? active() : unref(active)
		if (!isActive) return
		if (ignoreTyping && isTypingEvent(e)) return
		if (skipWhenDialogOpen && isDialogOpen()) return

		for (const def of shortcuts) {
			if (!def) continue
			if (def.guard && !def.guard(e)) continue
			if (matchShortcut(def, e)) {
				if (def.preventDefault !== false) e.preventDefault()
				if (def.stopPropagation) e.stopPropagation()
				def.action(e)
				break
			}
		}
	}

	onMounted(() => {
		target?.addEventListener('keydown', handler as EventListener)
	})
	onBeforeUnmount(() => {
		target?.removeEventListener('keydown', handler as EventListener)
	})

	return {
		stop: () => target?.removeEventListener('keydown', handler as EventListener),
	}
}

// Ctrl+S (Cmd+S on mac) — the shared "save" combo every form uses.
export function saveShortcut(action: ShortcutAction): ShortcutDef {
	return {
		match: (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's',
		action,
	}
}
