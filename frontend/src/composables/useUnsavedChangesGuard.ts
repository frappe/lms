import { onScopeDispose, reactive, watch } from 'vue'
import {
	onBeforeRouteLeave,
	onBeforeRouteUpdate,
	type RouteLocationNormalized,
} from 'vue-router'
import { createDialog } from '@/utils/dialogs'
import { MODAL_FORM_ROUTES } from '@/components/CommandPalette/paletteTypes'
import { hasDirtyForms } from '@/composables/useDirtyGuard'

export interface UnsavedChangesSource {
	isDirty: () => boolean
	isSaving: () => boolean
	/** Resolves true once the edits are saved; false leaves the user on the page. */
	save: () => Promise<boolean>
	/** The route param whose change remounts the form, such as `courseName`. */
	param?: string
}

export interface DiscardableChanges extends UnsavedChangesSource {
	/** Puts the stored values back, for a switch that keeps the page mounted. */
	discard: () => void
}

interface DialogContext {
	close: () => void
}

/**
 * Asks whether to save, discard or keep unsaved edits.
 * Resolves true to leave, false to stay; dismissing the dialog stays.
 */
export function confirmLeave(
	save: () => Promise<boolean>,
	onDiscard?: () => void
): Promise<boolean> {
	return new Promise((resolve) => {
		const dialog = reactive({
			title: __('Discard unsaved changes?'),
			message: __('You have unsaved changes. Leaving now discards them.'),
			size: 'sm',
			show: false,
			actions: [
				{
					label: __('Save and leave'),
					variant: 'solid',
					onClick: async ({ close }: DialogContext) => {
						resolve(await save())
						close()
					},
				},
				{
					label: __('Discard'),
					theme: 'red',
					variant: 'subtle',
					onClick: ({ close }: DialogContext) => {
						onDiscard?.()
						resolve(true)
						close()
					},
				},
				{
					label: __('Stay'),
					onClick: ({ close }: DialogContext) => close(),
				},
			],
		})
		// createDialog keeps this same proxy, so Escape and the backdrop are seen here.
		const stop = watch(
			() => dialog.show,
			(open) => {
				if (open) return
				stop()
				resolve(false)
			}
		)
		createDialog(dialog)
	})
}

// A modal form route keeps the page mounted behind it, edits included.
const keepsPage = (to: RouteLocationNormalized): boolean =>
	MODAL_FORM_ROUTES.has(to.name as string)

const guardedPages = new Set<() => boolean>()

/** Whether a mounted page or settings form holds edits a navigation would drop. */
export function hasUnsavedEdits(): boolean {
	return [...guardedPages].some((check) => check()) || hasDirtyForms()
}

/**
 * Confirms before a navigation or a reload drops the form's unsaved edits.
 * Tab and student view switches keep the page mounted, so they pass.
 */
export function useUnsavedChangesGuard(source: UnsavedChangesSource): void {
	const hasUnsavedEdits = (): boolean => source.isDirty() && !source.isSaving()
	guardedPages.add(hasUnsavedEdits)
	onScopeDispose(() => guardedPages.delete(hasUnsavedEdits))

	const guard = (to: RouteLocationNormalized): true | Promise<boolean> => {
		if (!hasUnsavedEdits() || keepsPage(to)) return true
		return confirmLeave(source.save)
	}

	onBeforeRouteLeave(guard)
	onBeforeRouteUpdate((to, from) => {
		const { param } = source
		if (!param || to.params[param] === from.params[param]) return true
		return guard(to)
	})

	// The browser writes the text; both calls are needed for its prompt.
	const warnOnUnload = (event: BeforeUnloadEvent): void => {
		if (!hasUnsavedEdits()) return
		event.preventDefault()
		event.returnValue = ''
	}
	window.addEventListener('beforeunload', warnOnUnload)
	onScopeDispose(() => window.removeEventListener('beforeunload', warnOnUnload))
}

/**
 * Asks about unsaved edits before a switch that keeps the page mounted, such as
 * student view, which shows the stored course or batch. Discard reverts the form.
 * Resolves true to go ahead.
 */
export function confirmUnsavedChanges(
	source: DiscardableChanges
): Promise<boolean> {
	if (!source.isDirty() || source.isSaving()) return Promise.resolve(true)
	return confirmLeave(source.save, source.discard)
}
