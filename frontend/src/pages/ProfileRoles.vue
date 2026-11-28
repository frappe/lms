<template>
	<div class="mt-7">
		<h2 class="mb-3 text-md font-semibold text-ink-gray-9">
			{{ __('Settings') }}
		</h2>
		<div
			v-if="readOnlyMode"
			class="flex items-center gap-x-2 text-sm text-ink-gray-7 bg-surface-gray-1 px-3 py-2 rounded-5 w-full text-center"
		>
			<span class="lucide-circle-alert size-4" />
			<span>
				{{ __('You cannot change the roles in read-only mode.') }}
			</span>
		</div>
		<RoleSwitchesSkeleton
			v-else-if="!rolesResource.data && !rolesResource.error"
			class="mt-5"
			data-testid="roles-skeleton"
		/>
		<RoleSwitches v-else class="mt-5" :model-value="roles" @toggle="onToggle" />
		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>
	</div>
</template>
<script setup lang="ts">
import { call, createResource, toast } from 'frappe-ui'
import { reactive, watch } from 'vue'
import RoleSwitches from '@/components/Controls/RoleSwitches.vue'
import RoleSwitchesSkeleton from '@/components/Skeletons/RoleSwitchesSkeleton.vue'
import { useLoadingAnnouncement } from '@/utils/a11y'
import {
	ROLE_ROWS,
	noRoles,
	type MemberRoleKey,
} from '@/components/Settings/Members/members'

const roles = reactive(noRoles())
const readOnlyMode = window.read_only_mode

const props = defineProps<{
	profile: { data?: { name?: string } }
}>()

const rolesResource = createResource({
	url: 'lms.lms.utils.get_roles',
	makeParams(values: { member?: string }) {
		return {
			name: values.member,
		}
	},
	onSuccess(data: Record<string, boolean>) {
		for (const row of ROLE_ROWS) roles[row.key] = Boolean(data[row.key])
	},
})

const loadingAnnouncement = useLoadingAnnouncement(
	() => !rolesResource.data && !rolesResource.error,
	() => (rolesResource.data ? __('Roles loaded') : '')
)

watch(
	() => props.profile,
	(newValue) => {
		rolesResource.reload({
			member: newValue.data?.name,
		})
	},
	{ immediate: true }
)

const onToggle = async (key: MemberRoleKey, value: boolean) => {
	roles[key] = value
	const row = ROLE_ROWS.find((r) => r.key === key)
	if (!row) return
	await call('lms.lms.api.save_role', {
		user: props.profile.data?.name,
		role: row.role,
		value,
	})
	toast.success(__('Role updated successfully'))
}
</script>
