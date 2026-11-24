<template>
	<InviteStep
		:roles="roles"
		default-role="LMS Student"
		:first-role="firstRole"
		:send="send"
		:labels="labels"
		:can-go-back="canGoBack"
		@invitees="(people) => emit('invitees', people)"
		@done="finish"
		@skip="emit('skip')"
		@back="emit('back')"
	/>
</template>

<script setup>
import { toast } from 'frappe-ui'
import { InviteStep } from '@framework/ui/components/SetupFlow/index'
import { useInviteUser } from '@framework/ui/components/InviteUser/index'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import { getLmsBasePath } from '@/utils/basePath'

defineProps({
	canGoBack: { type: Boolean, default: false },
	/** The first row's role: who the owner most likely needs first, from their goal. */
	firstRole: { type: String, default: 'Course Creator' },
})
const emit = defineEmits(['done', 'skip', 'back', 'invitees'])

const roles = [
	{ label: __('Student'), value: 'LMS Student' },
	{ label: __('Course Creator'), value: 'Course Creator' },
	{ label: __('Batch Evaluator'), value: 'Batch Evaluator' },
	{ label: __('Moderator'), value: 'Moderator' },
]

const labels = {
	email: (row) => __('Email {0}', [row]),
	role: (row) => __('Role {0}', [row]),
	remove: (row) => __('Remove {0}', [row]),
	add: __('Add another'),
	send: __('Send invites'),
	continue: __('Continue'),
	sent: __('Sent'),
	skip: __('Skip this step'),
	back: __('Back'),
	invalid: __('Enter a valid email address'),
	duplicate: __('This email is already in the list'),
	failed: __('Could not send the invites. Please try again.'),
	failedTitle: (count) =>
		count === 1
			? __('1 invite could not be sent')
			: __('{0} invites could not be sent', [count]),
	failedWho: (emails) =>
		__('Could not invite {0}: their account is disabled.', [emails]),
}

// The checklist is set up when the app's sidebar mounts after setup; the step waits for it.
const onboarding = useOnboarding('learning')
const { invite } = useInviteUser({
	appName: 'lms',
	redirectPath: `/${getLmsBasePath()}`,
})

async function send(role, emails) {
	const result = await invite(emails.join(', '), [role])
	return {
		invited: result.invited_emails.length,
		failed: result.disabled_user_emails,
	}
}

function finish(result) {
	if (result.invited) {
		toast.success(__('{0} invited', [result.invited]))
		onboarding?.updateOnboardingStep('invite_students')
	}
	emit('done', result)
}
</script>
