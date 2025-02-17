<template>
	<Dialog
		v-model="show"
		:options="{
			size: 'xl',
			title: __('Login to Frappe Cloud'),
			actions: [
				{
					label: __('Verify'),
					variant: 'solid',
					onClick: (close) => {
						verifyCode(close)
					},
				},
			],
		}"
	>
		<template #body-content>
			<div>
				<p>
					{{ __('We have sent the verificaton code to your email id ') }}
					<b>{{ props.email }}</b>
				</p>
				<FormControl
					v-model="code"
					:label="__('Verification Code')"
					class="mb-4"
				/>
				<p>
					{{ __("Didn't receive the code?") }}
					<a href="#" @click="resendCode">{{ __('Resend') }}</a>
				</p>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { call, Dialog } from 'frappe-ui'
import { showToast } from '@/utils'

const show = defineModel()
const code = ref('')

const props = defineProps({
	email: {
		type: String,
		required: true,
	},
})

const verifyCode = (close) => {
	if (!code.value) {
		return
	}
	call(
		'frappe.integrations.frappe_providers.frappecloud_billing.verify_verification_code',
		{
			verification_code: code.value,
			route: window.route,
		}
	)
		.then((data) => {
			if (data.message.login_token) {
				close()
				window.open(
					`${frappeCloudBaseEndpoint}/api/method/press.api.developer.saas.login_to_fc?token=${data.message.login_token}`,
					'_blank'
				)
				showToast(
					__('Frappe Cloud Login Successful'),
					`<p>${__('You will be redirected to Frappe Cloud soon.')}</p><p>${__(
						"If you haven't been redirected,"
					)} <a href="${frappeCloudBaseEndpoint}/api/method/press.api.developer.saas.login_to_fc?token=${
						data.message.login_token
					}" target="_blank">${__('Click here to login')}</a></p>`,
					'check'
				)
			} else {
				showToast(__('Login failed'), __('Please try again'), 'x')
			}
		})
		.catch((err) => {
			showToast(__('Login failed'), __('Please try again'), 'x')
		})
}

const resendCode = () => {
	call(
		'frappe.integrations.frappe_providers.frappecloud_billing.send_verification_code'
	).catch((err) => {
		showToast(__('Failed to resend code'), __('Please try again'), 'x')
	})
}
</script>
