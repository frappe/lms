<template>
	<SettingsLayout
		:title="__(label)"
		:description="
			__(
				'Invite people to teach or learn on your site. Their role sets what they can do.'
			)
		"
	>
		<form
			class="flex flex-col gap-5 [&_textarea]:resize-none"
			@submit.prevent="send"
		>
			<FormControl
				v-model="emails"
				type="textarea"
				:label="__('Invite by email')"
				placeholder="user1@example.com, user2@example.com, ..."
				:description="__('Separate emails with commas.')"
			/>
			<FormControl
				v-model="role"
				type="select"
				:label="__('Role')"
				:options="roleOptions"
			/>
			<ErrorMessage :message="error" />
			<Button
				type="submit"
				variant="solid"
				class="w-fit"
				:label="__('Send invites')"
				:loading="invites.inviting"
				:disabled="!emails.trim()"
			/>
		</form>

		<template v-if="invites.pendingInvites.length">
			<h3 class="mt-8 text-base font-semibold text-ink-gray-8">
				{{ __('Pending invites') }}
			</h3>
			<ul class="mt-3 flex flex-col gap-1.5">
				<li
					v-for="invite in invites.pendingInvites"
					:key="invite.name"
					class="flex items-center justify-between rounded-6 bg-surface-gray-2 px-3 py-1"
				>
					<span class="truncate text-base text-ink-gray-8">
						{{ invite.email }}
						<span class="text-ink-gray-5"
							>({{ rolesLabel(invite.roles) }})</span
						>
					</span>
					<Button
						variant="ghost"
						icon="lucide-x"
						:tooltip="__('Cancel invite')"
						:aria-label="__('Cancel the invite to {0}').format(invite.email)"
						:loading="invites.cancellingName === invite.name"
						@click="cancel(invite)"
					/>
				</li>
			</ul>
		</template>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { Button, ErrorMessage, FormControl, toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { onMounted, ref } from 'vue'
import { useInviteUser } from '@framework/ui/components/InviteUser/index'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import { ROLE_ROWS, memberError } from '@/components/Settings/Members/members'
import { getLmsBasePath } from '@/utils/basePath'
import { validateEmail } from '@/utils'

// Settings > Invites, laid out like Helpdesk's and CRM's invite pages: invite by
// email with a role, then the invites nobody has accepted yet. Accepting makes
// the person a user, listed under Users instead.

defineProps<{ label: string }>()

const invites = useInviteUser({
	appName: 'lms',
	redirectPath: `/${getLmsBasePath()}`,
})
const onboarding = useOnboarding('learning')

const emails = ref('')
const role = ref('LMS Student')
const error = ref('')

onMounted(() => invites.load())

const roleOptions = ROLE_ROWS.map((row) => ({
	label: row.label(),
	value: row.role,
}))

const rolesLabel = (roles: string[]) =>
	roles
		.map((name) => ROLE_ROWS.find((row) => row.role === name)?.label() ?? name)
		.join(', ')

const send = async () => {
	const list = emails.value
		.split(',')
		.map((email) => email.trim())
		.filter(Boolean)
	const invalid = list.filter((email) => !validateEmail(email))
	if (invalid.length) {
		error.value = __('Check these emails: {0}').format(invalid.join(', '))
		return
	}
	error.value = ''
	try {
		const result = await invites.invite(list.join(', '), [role.value])
		report(result)
		emails.value = ''
	} catch (err) {
		error.value = memberError(
			err as FrappeResourceError,
			__('Could not send the invites. Please try again.')
		)
	}
}

const report = (result: {
	invited_emails: string[]
	pending_invite_emails: string[]
	accepted_invite_emails: string[]
	disabled_user_emails: string[]
}) => {
	if (result.invited_emails.length) {
		toast.success(__('{0} invited').format(result.invited_emails.length))
		onboarding?.updateOnboardingStep('invite_students')
	}
	const skipped = [
		[result.pending_invite_emails, __('Already invited: {0}')],
		[result.accepted_invite_emails, __('Already a user: {0}')],
		[result.disabled_user_emails, __('Account disabled: {0}')],
	] as const
	for (const [found, message] of skipped)
		if (found.length) toast.info(message.format(found.join(', ')))
}

const cancel = async (invite: { name: string; email: string }) => {
	try {
		await invites.cancel(invite.name)
		toast.success(__('Invite to {0} cancelled').format(invite.email))
	} catch (err) {
		toast.error(
			memberError(err as FrappeResourceError, __('Could not cancel the invite'))
		)
	}
}
</script>
