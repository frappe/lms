<template>
	<Dialog
		v-model:open="open"
		:title="__('Change password')"
		size="sm"
		@after-leave="reset"
	>
		<form class="flex flex-col gap-4" @submit.prevent="save">
			<FormControl
				v-model="current"
				type="password"
				:label="__('Current password')"
				autocomplete="current-password"
				required
			/>
			<FormControl
				v-model="next"
				type="password"
				:label="__('New password')"
				autocomplete="new-password"
				required
			/>
			<FormControl
				v-model="confirm"
				type="password"
				:label="__('Confirm new password')"
				autocomplete="new-password"
				required
			/>
			<ErrorMessage :message="error" />
			<div class="flex flex-col gap-3">
				<Button
					type="submit"
					variant="solid"
					:label="__('Update password')"
					:loading="saving"
					:disabled="!canSave"
				/>
				<Button
					v-if="user.data?.name !== 'Administrator'"
					variant="ghost"
					size="sm"
					class="self-center text-ink-gray-6"
					:label="
						resetSent
							? __('Reset link sent. Check your email.')
							: __('Forgot it? Email me a reset link')
					"
					:disabled="resetSent"
					:loading="sendingReset"
					@click="sendReset"
				/>
			</div>
		</form>
	</Dialog>
</template>

<script setup>
import {
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	call,
	toast,
} from 'frappe-ui'
import { computed, inject, ref } from 'vue'

const open = defineModel('open', { type: Boolean, default: false })

const user = inject('$user')

const current = ref('')
const next = ref('')
const confirm = ref('')
const error = ref('')
const saving = ref(false)
const sendingReset = ref(false)
const resetSent = ref(false)

const canSave = computed(
	() => current.value && next.value && confirm.value && !saving.value
)

function reset() {
	current.value = ''
	next.value = ''
	confirm.value = ''
	error.value = ''
	resetSent.value = false
}

async function save() {
	error.value = ''
	if (next.value !== confirm.value) {
		error.value = __('The new passwords do not match.')
		return
	}
	saving.value = true
	try {
		await call('frappe.core.doctype.user.user.update_password', {
			old_password: current.value,
			new_password: next.value,
		})
		toast.success(__('Your password is updated'))
		open.value = false
	} catch (e) {
		error.value =
			e.messages?.[0] || __('Could not update your password. Please try again.')
	} finally {
		saving.value = false
	}
}

async function sendReset() {
	error.value = ''
	sendingReset.value = true
	try {
		await call('frappe.core.doctype.user.user.reset_password', {
			user: user.data?.name,
		})
		resetSent.value = true
	} catch (e) {
		error.value =
			e.messages?.[0] || __('Could not send the reset link. Please try again.')
	} finally {
		sendingReset.value = false
	}
}
</script>
