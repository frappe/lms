import { Dialog, ErrorMessage } from 'frappe-ui'
import { h, reactive, ref } from 'vue'

let dialogs = ref([])

export let Dialogs = {
	name: 'Dialogs',
	render() {
		return dialogs.value.map((dialog) => {
			// A dialog that IS a component draws its own Dialog, so it renders
			// directly rather than nested inside a second one. It takes the same
			// `show` model, letting a caller with no template open a modal.
			if (dialog.component) {
				return h(dialog.component, {
					...dialog.props,
					show: dialog.show,
					'onUpdate:show': (val) => (dialog.show = val),
				})
			}
			return h(
				Dialog,
				{
					// Read each field here (not by spreading `dialog`) so the render
					// stays reactive to it.
					title: dialog.title,
					size: dialog.size,
					icon: dialog.icon,
					position: dialog.position,
					actions: dialog.actions,
					modelValue: dialog.show,
					'onUpdate:modelValue': (val) => (dialog.show = val),
				},
				() => [
					h(
						'p',
						{ class: 'text-p-base text-ink-gray-7' },
						dialog.message
					),
					h(ErrorMessage, { class: 'mt-2', message: dialog.error }),
				]
			)
		})
	},
}

export function createDialog(options) {
	let dialog = reactive(options)
	dialog.key = `dialog-${Math.random().toString(36).slice(2, 9)}`
	dialogs.value.push(dialog)
	dialog.show = true
	// The reactive entry, so a caller can reopen this dialog instead of pushing
	// a second copy of it onto a list nothing ever empties.
	return dialog
}

export function isDialogOpen() {
	return dialogs.value.some((dialog) => dialog.show)
}
