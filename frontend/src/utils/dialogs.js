import { Dialog, ErrorMessage } from 'frappe-ui'
import { h, reactive, ref } from 'vue'

let dialogs = ref([])

export let Dialogs = {
	name: 'Dialogs',
	render() {
		return dialogs.value.map((dialog) => {
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
}

export function isDialogOpen() {
	return dialogs.value.some((dialog) => dialog.show)
}
