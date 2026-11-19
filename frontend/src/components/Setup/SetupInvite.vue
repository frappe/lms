<template>
	<div class="flex flex-col gap-2">
		<div v-for="(row, index) in rows" :key="row.id" class="flex flex-col gap-1">
			<div class="group relative flex items-center gap-1.5 sm:gap-2">
				<div class="min-w-0 flex-1">
					<FormControl
						v-model="row.email"
						type="email"
						placeholder="name@example.com"
						:aria-label="__('Email {0}', [index + 1])"
					/>
				</div>
				<div class="w-40 shrink-0 sm:w-44">
					<FormControl
						v-model="row.role"
						type="select"
						:options="roles"
						:aria-label="__('Role {0}', [index + 1])"
					/>
				</div>
				<Button
					v-if="rows.length > 1"
					variant="ghost"
					icon="lucide-x"
					class="shrink-0 text-ink-gray-6 transition-opacity sm:absolute sm:-end-8 sm:top-0 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
					:aria-label="__('Remove {0}', [index + 1])"
					:disabled="sending"
					@click="rows.splice(index, 1)"
				/>
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
				:label="__('Back')"
				:disabled="sending"
				@click="emit('back')"
			>
				<template #prefix>
					<span class="lucide-arrow-left size-4 rtl:rotate-180" />
				</template>
			</Button>
		</div>
	</div>
</template>

<script setup>
import { Button, ErrorMessage, FormControl, toast } from 'frappe-ui'
import { useInviteUser } from '@framework/ui/components/InviteUser/index'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import { computed, ref, watch } from 'vue'
import { getLmsBasePath } from '@/utils/basePath'
import { validateEmail } from '@/utils'

const props = defineProps({
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

// The checklist is set up when the app's sidebar mounts after setup; the step waits for it.
const onboarding = useOnboarding('learning')
const { invite } = useInviteUser({
	appName: 'lms',
	redirectPath: `/${getLmsBasePath()}`,
})

let lastRowId = 0
const rows = ref([newRow(props.firstRole), newRow()])
// Going back and picking another goal changes the suggestion, until a name is typed.
watch(
	() => props.firstRole,
	(role) => {
		const first = rows.value[0]
		if (first && !first.email.trim()) first.role = role
	}
)
const sending = ref(false)
const error = ref('')

const filled = computed(() => rows.value.filter((row) => row.email.trim()))
watch(
	rows,
	() =>
		emit(
			'invitees',
			filled.value
				.filter((row) => !isInvalid(row))
				.map((row) => ({ email: row.email.trim(), role: row.role }))
		),
	{ deep: true }
)
const canSend = computed(
	() => filled.value.length && !filled.value.some(isInvalid)
)

function newRow(role = 'LMS Student') {
	return { id: ++lastRowId, email: '', role }
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
