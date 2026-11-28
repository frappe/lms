import { computed, ref } from 'vue'
import { useSettings } from '@/stores/settings'

/** Gates selling anything on the Payments app, with the dialog that says so. */
export function usePaymentsApp() {
	const settingsStore = useSettings()

	/** Opens PaymentsAppDialog. */
	const needsPaymentsApp = ref<boolean>(false)

	// Blocks only when the app is known to be missing; the server is the hard guard.
	const isPaymentsAppMissing = computed<boolean>(
		() =>
			Boolean(settingsStore.settings?.data) &&
			!settingsStore.settings.data.is_payments_app_installed
	)

	/** False, opening the dialog, while the Payments app is missing. */
	function canSell(): boolean {
		if (!isPaymentsAppMissing.value) return true
		needsPaymentsApp.value = true
		return false
	}

	return { needsPaymentsApp, isPaymentsAppMissing, canSell }
}
