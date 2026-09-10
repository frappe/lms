<template>
	<SettingsLayout
		:title="formTitle"
		show-back
		:unsaved="isDirty"
		:save-label="refusal ? undefined : __('Save')"
		:saving="saving"
		:can-save="isDirty"
		save-testid="member-save"
		@back="emit('back')"
		@save="save"
	>
		<div v-if="refusal" class="text-p-base text-ink-gray-6">
			{{ refusal }}
		</div>
		<div
			v-else-if="!member"
			class="flex flex-1 items-center justify-center py-20"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>
		<div v-else data-testid="member-fields" class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<FormControl
					v-model="member.first_name"
					:label="__('First Name')"
					type="text"
					placeholder="Ada"
					required
					autocomplete="off"
				/>
				<FormControl
					v-model="member.last_name"
					:label="__('Last Name')"
					type="text"
					placeholder="Lovelace"
					autocomplete="off"
				/>
				<FormControl
					v-model="member.email"
					:label="__('Email')"
					type="email"
					placeholder="ada@example.com"
					:disabled="isEdit"
					:required="!isEdit"
					autocomplete="off"
				/>
				<FormControl
					v-model="member.username"
					:label="__('Username')"
					type="text"
					placeholder="ada"
					autocomplete="off"
				/>
				<FormControl
					v-model="member.phone"
					:label="__('Phone')"
					type="text"
					placeholder="+44 20 7946 0958"
					autocomplete="off"
				/>
				<FormControl
					v-model="member.mobile_no"
					:label="__('Mobile No')"
					type="text"
					placeholder="+44 7700 900123"
					autocomplete="off"
				/>
				<FormControl
					v-model="member.location"
					:label="__('Location')"
					type="text"
					placeholder="London"
					autocomplete="off"
				/>
			</div>

			<FormControl
				v-model="member.bio"
				:label="__('Bio')"
				type="textarea"
				:rows="3"
				:placeholder="__('A line or two about this person')"
				autocomplete="off"
			/>

			<div class="h-px border-t border-outline-elevation-2" />

			<div class="text-p-lg-semibold text-ink-gray-8">{{ __('Roles') }}</div>

			<div class="divide-y divide-outline-elevation-2">
				<div
					v-for="row in ROLE_ROWS"
					:key="row.key"
					data-testid="role-row"
					class="flex items-center justify-between gap-8 py-3"
				>
					<label
						:for="switchId(row.key)"
						class="text-p-base-medium text-ink-gray-7"
					>
						{{ row.label() }}
					</label>
					<div class="shrink-0">
						<BooleanSwitch
							:id="switchId(row.key)"
							v-model="roles[row.key]"
							size="sm"
						/>
					</div>
				</div>
			</div>
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import {
	FormControl,
	LoadingIndicator,
	call,
	createResource,
	toast,
} from 'frappe-ui'
import { computed, inject, reactive, useId, ref } from 'vue'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import {
	MEMBERS_DOCTYPE,
	ROLE_ROWS,
	memberError,
	noRoles,
	rolesFrom,
	type MemberRoleKey,
} from '@/components/Settings/Members/members'
import { useSettingsRecord } from '@/composables/useSettingsRecord'
import { runSave, useSaveState } from '@/composables/useSettingsSave'
import { NEW_RECORD } from '@/composables/useSettingsSource'
import { notifyMembersChanged } from '@/stores/members'
import { sanitizeHTML } from '@/utils'
import type { SessionUser, SettingsListRow } from '@/types'

/**
 * One member, behind both New and a row.
 *
 * Hand-rolled rather than routed through SettingsFields, because a member is
 * two things saved two different ways — a User document, written through the
 * document resource, and four roles, each of which is its own `save_role` call.
 *
 * That split is also what keeps the page usable by a moderator who is not a
 * System Manager. User's only writing DocPerm is System Manager's, so the
 * profile fields need one; the roles do not. The document is written only when
 * something in it actually changed, so a moderator editing roles alone never
 * reaches for it.
 *
 * Handed the open record's name and reporting only that it is finished, the
 * same contract ZoomAccountForm.vue has. `row` comes with it so the header can
 * name the person before their document has landed.
 */

const props = defineProps<{
	name?: string | null
	row?: SettingsListRow | null
}>()

const emit = defineEmits<{ back: [] }>()

const user = inject<SessionUser>('$user')!
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')

const state = useSaveState()
const saving = state.saving

const record = computed(() => props.name ?? null)

const isEdit = computed(
	() => Boolean(record.value) && record.value !== NEW_RECORD
)

const formTitle = computed(() => {
	if (!isEdit.value) return __('Add New Member')
	return props.row?.full_name || __('Edit Member')
})

// The settings surface is gated already (UserDropdown.vue), but this form is
// one click away from a list a deep link opens. `is_moderator` alone,
// deliberately: get_members and save_role both `frappe.only_for("Moderator")`.
// This is a UX gate, not the authorization boundary; those only_for calls are.
const refusal = computed(() => {
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode)
		return __('This site is in read-only mode.')
	if (!user.data?.is_moderator)
		return __('You are not permitted to manage members.')
	return ''
})

const roles = reactive(noRoles())
const initialRoles = reactive(noRoles())

const rolesDirty = computed(() =>
	ROLE_ROWS.some((row) => roles[row.key] !== initialRoles[row.key])
)

// The User document itself. NEW_RECORD yields a draft that `save()` inserts,
// so New and edit share the same fields and handle. A member is dirty for two
// reasons: the profile fields, and the roles, saved through their own endpoint.
const {
	source,
	doc: member,
	isDirty,
} = useSettingsRecord({
	doctype: MEMBERS_DOCTYPE,
	record,
	dirty: (s) => s.isDirty || rolesDirty.value,
})

// The label is drawn by the row rather than by the switch, so it has to reach
// the control as a <label for>: frappe-ui's Switch generates an id only when it
// is given none, and never hands it back out.
const formId = useId()
const switchId = (key: MemberRoleKey) => `${formId}-${key}`

// get_member, not the list endpoint: that one hard-filters `enabled = 1` and
// pages, so a disabled member could never come back. It's also the only read
// of a member's roles a moderator without System Manager can make.
const memberFetch = createResource({
	url: 'lms.lms.api.get_member',
	makeParams: () => ({ member: record.value }),
	auto: false,
	onSuccess(row: { roles?: string[] }) {
		const granted = rolesFrom(row?.roles)
		// A switch flipped while the row was still in flight is the newer intent,
		// so only the baseline moves under it.
		if (!rolesDirty.value) Object.assign(roles, granted)
		Object.assign(initialRoles, granted)
	},
}) as unknown as { fetch: () => void }

// Named here rather than left to the server, which answers one missing field
// per round trip. Everything past the first gap still has to survive the server
// saying no.
const validate = (): string => {
	const doc = member.value
	if (!doc) return __('This member has not loaded yet')
	if (!isEdit.value && !String(doc.email ?? '').trim())
		return __('Email is required')
	if (!String(doc.first_name ?? '').trim()) return __('First Name is required')
	return ''
}

const saveRoles = async (name: string) => {
	for (const row of ROLE_ROWS) {
		if (roles[row.key] === initialRoles[row.key]) continue
		await call('lms.lms.api.save_role', {
			user: name,
			role: row.role,
			value: roles[row.key] ? 1 : 0,
		})
		// Recorded per row, not after the loop. A refused write partway through
		// leaves the rows already saved reported as saved, so a retry sends only
		// what is still outstanding.
		initialRoles[row.key] = roles[row.key]
	}
}

const save = () => {
	if (refusal.value || !isDirty.value) return

	const creating = !isEdit.value
	return runSave(state, {
		validate,
		toastInvalid: true,
		run: async () => {
			let name = record.value
			if (source.isDirty) {
				const doc = member.value
				// The same treatment the user's own profile form gives it: a bio is
				// drawn as HTML on the profile page.
				if (doc?.bio) doc.bio = sanitizeHTML(doc.bio)
				const saved = (await source.save()) as { name?: string } | undefined
				if (creating) name = saved?.name ?? null
			}

			if (name && name !== NEW_RECORD) await saveRoles(name)

			if (creating) {
				if (user.data?.is_system_manager)
					updateOnboardingStep('invite_students')
				capture('user_added')
			}
		},
		success: creating ? __('Member added successfully') : __('Member updated'),
		after: () => {
			notifyMembersChanged()
			emit('back')
		},
		failure: (error: any) =>
			memberError(
				error,
				creating ? __('Unable to add member') : __('Unable to update user')
			),
	})
}

// The roles read ran from openForm; the form mounts on one member now, so it
// runs at setup. Placed last because memberFetch is a const above it only by
// declaration order, this is the first point every initialiser has run.
if (isEdit.value && !refusal.value) memberFetch.fetch()
</script>
