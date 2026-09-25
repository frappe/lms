import { toast } from 'frappe-ui'
import { errorText } from './format'

// Runs a server action, toasting the outcome. Resolves to undefined on failure.
export async function runAction(action, success) {
	try {
		const result = await action()
		if (success) toast.success(success)
		return result
	} catch (error) {
		toast.error(errorText(error))
		return undefined
	}
}
