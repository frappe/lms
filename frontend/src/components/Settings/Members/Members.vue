<template>
	<SettingsList
		v-if="view === 'list'"
		:title="__(label)"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search users')"
		empty-name="Users"
		empty-icon="lucide-user"
		@new="openForm(null)"
		@load-more="list.loadMore()"
		@row-click="openForm"
	>
		<template #header-bottom>
			<Select
				v-model="role"
				class="w-40"
				:aria-label="__('Filter by role')"
				:options="roleOptions()"
			/>
		</template>
	</SettingsList>

	<MemberForm v-else :name="selected" :row="selectedRow" @back="closeForm()" />
</template>

<script setup lang="ts">
import { Select } from 'frappe-ui'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MemberForm from '@/components/Settings/Members/MemberForm.vue'
import SettingsList from '@/components/Layouts/settings/desktop/SettingsList.vue'
import {
	MEMBERS_DOCTYPE,
	MEMBERS_METHOD,
	confirmMemberDeletion,
	memberColumns,
	roleOptions,
} from '@/components/Settings/Members/members'
import { useSettingsMethodResource } from '@/composables/useSettingsListResource'
import { NEW_RECORD } from '@/composables/useSettingsSource'
import { membersRevision } from '@/stores/members'
import type { SettingsListRow } from '@/types'

// Settings > Users: the list of members, with the form behind New and
// behind a row in MemberForm.vue. Three files per list page (config, list,
// form), imported statically so a row click reveals it on the same tick.

defineProps<{ label: string }>()

const router = useRouter()

const view = ref<'list' | 'form'>('list')
const role = ref('All')

// The record the form is on: an email address, or NEW_RECORD. The row behind it
// is kept alongside so the header can name the person before their document has
// landed.
const selected = ref<string | null>(null)
const selectedRow = ref<SettingsListRow | null>(null)

const list = useSettingsMethodResource<SettingsListRow>({
	method: MEMBERS_METHOD,
	doctype: MEMBERS_DOCTYPE,
	params: () => ({ role: role.value }),
})

// The role goes to the server, so what is on screen was fetched under the old
// one and none of it can be kept.
watch(role, () => list.reload())

// A member saved anywhere else, the phone's form route among them,
// announces itself through the store.
watch(membersRevision, () => list.reload())

const openProfile = (row: SettingsListRow) => {
	if (!row.username) return
	// A route with no hash leaves the settings hash behind, and that is what
	// closes the dialog now that the hash is what opens it.
	router.push({ name: 'Profile', params: { username: row.username } })
}

const columns = memberColumns({
	profile: openProfile,
	remove: (row) => confirmMemberDeletion(row, () => list.reload()),
})

const openForm = (row: SettingsListRow | null) => {
	selectedRow.value = row
	selected.value = row ? String(row.name) : NEW_RECORD
	view.value = 'form'
}

const closeForm = () => {
	view.value = 'list'
	selected.value = null
	selectedRow.value = null
	list.reload()
}
</script>
