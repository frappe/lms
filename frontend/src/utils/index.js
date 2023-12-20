import { toast } from 'frappe-ui'

export function createToast(options) {
	toast({
		position: 'bottom-right',
		...options,
	})
}
