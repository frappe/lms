<template>
	<div class="flex flex-col gap-2">
		<div v-for="(row, index) in rows" :key="index" class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<div class="min-w-0 flex-1">
					<FormControl
						v-model="row.email"
						type="email"
						placeholder="name@example.com"
						:aria-label="__('Email {0}', [index + 1])"
					/>
				</div>
				<div class="w-36 shrink-0">
					<FormControl
						v-model="row.role"
						type="select"
						:options="roles"
						:aria-label="__('Role {0}', [index + 1])"
					/>
				</div>
			</div>
			<ErrorMessage
				v-if="isInvalid(row)"
				:message="__('Enter a valid email address')"
			/>
		</div>
		<Button
			variant="subtle"
			class="mt-1 self-start"
			icon-left="lucide-plus"
			:label="__('Add another')"
			@click="rows.push(newRow())"
		/>
		<ErrorMessage v-if="error" :message="error" />

		<div class="mt-6 flex items-center gap-2">
			<Button
				variant="solid"
				:label="__('Send invites')"
				:loading="sending"
				:disabled="!canSend"
				@click="send"
			/>
			<Button
				variant="ghost"
				class="text-ink-gray-6"
				:label="__('Skip this step')"
				:disabled="sending"
				@click="emit('skip')"
			/>
			<Button
				v-if="canGoBack"
				variant="ghost"
				class="-me-2 ms-auto text-ink-gray-6"
				icon-left="lucide-arrow-left"
				:label="__('Back')"
				:disabled="sending"
				@click="emit('back')"
			/>
		</div>
	</div>
</template>

<script setup>
import { Button, ErrorMessage, FormControl, toast } from 'frappe-ui'
import { useInviteUser } from '@framework/ui/components/InviteUser/index'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import { computed, ref } from 'vue'
import { getLmsBasePath } from '@/utils/basePath'
import { validateEmail } from '@/utils'

defineProps({ canGoBack: { type: Boolean, default: false } })
const emit = defineEmits(['done', 'skip', 'back'])

const roles = [
	{ label: __('Student'), value: 'LMS Student' },
	{ label: __('Course Creator'), value: 'Course Creator' },
	{ label: __('Moderator'), value: 'Moderator' },
]

// The checklist is set up after the reload that follows setup; the step waits for it.
const onboarding = useOnboarding('learning')
const { invite } = useInviteUser({
	appName: 'lms',
	redirectPath: `/${getLmsBasePath()}`,
})

const rows = ref([newRow(), newRow()])
const sending = ref(false)
const error = ref('')

const filled = computed(() => rows.value.filter((row) => row.email.trim()))
const canSend = computed(
	() => filled.value.length && !filled.value.some(isInvalid)
)

function newRow() {
	return { email: '', role: 'LMS Student' }
}

function isInvalid(row) {
	const email = row.email.trim()
	return Boolean(email) && !validateEmail(email)
}

async function send() {
	sending.value = true
	error.value = ''
	const byRole = {}
	for (const row of filled.value) {
		;(byRole[row.role] ??= []).push(row.email.trim())
	}
	try {
		let invited = 0
		for (const [role, emails] of Object.entries(byRole)) {
			const result = await invite(emails.join(', '), [role])
			invited += result.invited_emails.length
			// Sent rows go, so a retry after a later failure does not send them again.
			rows.value = rows.value.filter(
				(row) => !(row.role === role && row.email.trim())
			)
		}
		if (invited) {
			toast.success(__('{0} invited', [invited]))
			onboarding?.updateOnboardingStep('invite_students')
		}
		emit('done', { invited, roles: Object.keys(byRole) })
	} catch (e) {
		error.value =
			e.messages?.[0] || __('Could not send the invites. Please try again.')
	} finally {
		sending.value = false
	}
}
</script>
