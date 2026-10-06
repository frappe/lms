import { Dialog } from 'frappe-ui'
import { h, reactive, ref } from 'vue'

let dialogs = ref([])

export let Dialogs = {
	name: 'Dialogs',
	render() {
		return dialogs.value.map((dialog) =>
			// Read each field here, not by spreading `dialog`, so the render
			// stays reactive to it.
			h(Dialog, {
				title: dialog.title,
				message: dialog.message,
				size: dialog.size,
				actions: dialog.actions,
				open: dialog.show,
				'onUpdate:open': (val) => (dialog.show = val),
			})
		)
	},
}

export function createDialog(options) {
	let dialog = reactive(options)
	dialogs.value.push(dialog)
	dialog.show = true
}

export function isDialogOpen() {
	return dialogs.value.some((dialog) => dialog.show)
}
