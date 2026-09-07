<template>
	<FormShell
		:title="isEdit ? __('Edit Member') : __('Add New Member')"
		size="lg"
		@close="close"
	>
		<template #default>
			<div v-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="member-fields" class="space-y-4">
				<FormControl
					v-model="member.email"
					:label="__('Email')"
					placeholder="jane@doe.com"
					type="email"
					:required="!isEdit"
					:disabled="isEdit"
					@keyup.enter="submit()"
				/>
				<div v-if="!isEdit" class="flex items-center gap-3">
					<FormControl
						v-model="member.first_name"
						:label="__('First Name')"
						placeholder="Jane"
						type="text"
						class="w-full"
					/>
					<FormControl
						v-model="member.last_name"
						:label="__('Last Name')"
						placeholder="Doe"
						type="text"
						class="w-full"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<div class="text-p-sm-medium text-ink-gray-7">
						{{ __('Roles') }}
					</div>
					<div class="grid md:grid-cols-2 gap-x-6 gap-y-3">
						<BooleanSwitch
							size="sm"
							:label="__('Student')"
							v-model="roles.lms_student"
						/>
						<BooleanSwitch
							size="sm"
							:label="__('Course Creator')"
							v-model="roles.course_creator"
						/>
						<BooleanSwitch
							size="sm"
							:label="__('Evaluator')"
							v-model="roles.batch_evaluator"
						/>
						<BooleanSwitch
							size="sm"
							:label="__('Moderator')"
							v-model="roles.moderator"
						/>
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div v-if="!refusal" class="flex items-center justify-end">
				<HeaderButton
					data-testid="member-save"
					:label="__('Save')"
					variant="solid"
					:loading="submitting"
					:disabled="isEdit && !memberRow"
					@click="submit()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import { call, createResource, FormControl, toast } from 'frappe-ui'
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import { notifyMembersChanged } from '@/stores/members'
import { cleanError } from '@/utils'
import type { Resource, SessionUser } from '@/types'

type MemberRow = { name: string; roles?: string[] }

const props = defineProps<{ memberID: string }>()

const user = inject<SessionUser>('$user')!
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')

// House style for a route that serves both create and edit
// (`/job-opening/:jobName/edit`, JobForm.vue:147-149).
const isEdit = computed(() => props.memberID !== 'new')

// Only reached on a deep link or a reload — opened from Members.vue this pops
// back to whatever page the settings dialog was floating over (useFormRoute.ts).
// Settings itself is that dialog and has no address, so a URL that arrives here
// cold has nothing settings-shaped to be sent back to.
//
// The You page, then: it is the phone's account surface, it is a real route on
// every viewport, and it is the nearest thing left to the page this form used
// to close onto. Home would work too and says less.
const { close } = useFormRoute({ name: 'MobileYou' })

// Members.vue's Add button carried no gate of its own — the gate was on the
// settings surface around it (UserDropdown.vue:59-62 for the desktop dialog),
// and a URL goes through neither. `is_moderator` alone, deliberately: this is
// the narrowest gate in settings and get_members/save_role both
// `frappe.only_for("Moderator")`.
//
// UX gate, not an authorization boundary — those two only_for calls are
// (lms/lms/api.py:977 and :1851).
const refusal = computed(() => {
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode)
		return __('This site is in read-only mode.')
	if (!user.data?.is_moderator)
		return __('You are not permitted to manage members.')
	return ''
})

const ROLE_MAP: Record<string, string> = {
	moderator: 'Moderator',
	course_creator: 'Course Creator',
	batch_evaluator: 'Batch Evaluator',
	lms_student: 'LMS Student',
}

const member = reactive({
	email: isEdit.value ? props.memberID : '',
	first_name: '',
	last_name: '',
})

const roles = reactive({
	moderator: false,
	course_creator: false,
	batch_evaluator: false,
	lms_student: false,
})

const initialRoles = reactive({ ...roles })
const submitting = ref(false)

// C4 — edit mode used to be seeded from the row Members.vue already held in
// memory, which on a cold deep link does not exist.
//
// get_member, not the get_members list endpoint: that one hard-filters
// `enabled = 1` and pages at MEMBERS_PAGE_LENGTH, so a disabled member, or one
// whose address is a substring of more than a page of other members', never
// came back — and the form sat with Save permanently disabled and nothing on
// screen saying why.
const memberFetch = createResource({
	url: 'lms.lms.api.get_member',
	makeParams() {
		return { member: props.memberID }
	},
	auto: false,
}) as unknown as Resource<MemberRow | null>

onMounted(() => {
	if (isEdit.value && !refusal.value) memberFetch.fetch()
})

const memberRow = computed<MemberRow | null>(() =>
	isEdit.value ? memberFetch.data ?? null : null
)

// `immediate` matters: the modal's watcher only ran when the dialog opened, and
// a route component is already open by the time it mounts.
watch(
	memberRow,
	(found) => {
		const current = found?.roles ?? []
		for (const key of Object.keys(ROLE_MAP) as (keyof typeof roles)[]) {
			roles[key] = current.includes(ROLE_MAP[key])
			initialRoles[key] = roles[key]
		}
	},
	{ immediate: true }
)

// Stands in for the modal's `created`/`updated` emits: a route component has no
// parent listening. A signal rather than the parent's resource, because that
// resource cannot be cached — see the note in @/stores/members. Nobody is
// listening on a phone deep link, which is correct: Members.vue fetches on
// mount.
const reloadMembers = () => {
	notifyMembersChanged()
}

const errorMessage = (err: { messages?: string[] }, fallback: string): string =>
	cleanError(err.messages?.[0]) || fallback

const assignRoles = async (userEmail: string) => {
	for (const [key, checked] of Object.entries(roles)) {
		if (checked)
			await call('lms.lms.api.save_role', {
				user: userEmail,
				role: ROLE_MAP[key],
				value: 1,
			})
	}
}

const addMember = async () => {
	if (!member.email?.trim()) {
		toast.error(__('Email is required'))
		return
	}

	submitting.value = true
	try {
		const created = await call('frappe.client.insert', {
			doc: {
				doctype: 'User',
				email: member.email.trim(),
				first_name: member.first_name.trim() || undefined,
				last_name: member.last_name.trim() || undefined,
			},
		})

		await assignRoles(created.name)

		if (user.data?.is_system_manager) updateOnboardingStep('invite_students')
		capture('user_added')
		toast.success(__('Member added successfully'))
		reloadMembers()
		close()
	} catch (err: any) {
		toast.error(errorMessage(err, __('Unable to add member')))
	} finally {
		submitting.value = false
	}
}

const saveRoles = async () => {
	submitting.value = true
	try {
		for (const key of Object.keys(ROLE_MAP) as (keyof typeof roles)[]) {
			if (roles[key] !== initialRoles[key]) {
				await call('lms.lms.api.save_role', {
					user: props.memberID,
					role: ROLE_MAP[key],
					value: roles[key] ? 1 : 0,
				})
			}
		}

		toast.success(__('Member updated'))
		reloadMembers()
		close()
	} catch (err: any) {
		toast.error(errorMessage(err, __('Unable to update member')))
	} finally {
		submitting.value = false
	}
}

const submit = () => {
	if (refusal.value || submitting.value) return
	// Edit mode before the row lands would post a role diff against an all-off
	// snapshot and strip every role the member has; the button is disabled for
	// the same reason.
	if (isEdit.value && !memberRow.value) return
	return isEdit.value ? saveRoles() : addMember()
}
</script>
