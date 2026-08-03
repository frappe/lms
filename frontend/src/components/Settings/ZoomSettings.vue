<template>
	<SettingsLayout
		v-if="view === 'list'"
		:title="label"
		:description="__(description || '')"
	>
		<template #header-actions>
			<Button variant="solid" @click="openForm('new')">
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				{{ __('New') }}
			</Button>
		</template>
		<List
			v-if="zoomAccounts.data?.length"
			:columns="columns"
			class="list-row-px-3 [--list-row-height:3.5rem]"
		>
			<ListHeader>
				<ListHeaderCell>{{ __('Account') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Member') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Enabled') }}</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListRows
				:items="zoomAccounts.data"
				row-key="name"
				v-slot="{ item: row }"
			>
				<ListRow @click="openForm(row.name)">
					<ListCell>
						<div class="flex min-w-0 flex-col">
							<span class="truncate text-p-base text-ink-gray-8">
								{{ row.account_name || row.name }}
							</span>
							<span class="truncate text-p-sm text-ink-gray-5">
								{{ row.account_id }}
							</span>
						</div>
					</ListCell>
					<ListCell class="gap-3">
						<Avatar
							:image="row.member_image"
							:label="row.member_name"
							size="lg"
							class="shrink-0"
						/>
						<span class="truncate text-p-base text-ink-gray-6">
							{{ row.member_name }}
						</span>
					</ListCell>
					<!-- Row state, so it writes on change: spec §5, as CRM's do. -->
					<ListCell @click.stop>
						<!-- `label` renders visible text next to the control; the name
						     belongs in aria-label so the cell is just the switch. -->
						<Switch
							size="sm"
							:model-value="Boolean(row.enabled)"
							:aria-label="
								__('Enable {0}').format(row.account_name || row.name)
							"
							@update:model-value="(value) => toggleEnabled(row, value)"
						/>
					</ListCell>
					<ListCell @click.stop>
						<Dropdown
							:options="[
								{
									label: __('Delete'),
									icon: 'lucide-trash-2',
									onClick: () => removeAccount(row.name),
								},
							]"
							:button="{
								icon: 'lucide-more-horizontal',
								variant: 'ghost',
								label: __('More options'),
							}"
							placement="right"
						/>
					</ListCell>
				</ListRow>
			</ListRows>
		</List>
		<EmptyStateLayout
			v-else
			name="Zoom Settings"
			:description="__('Add one to get started')"
			icon="lucide-video"
		/>
	</SettingsLayout>
	<ZoomAccountForm
		v-else
		:accountID="currentAccount"
		v-model:zoomAccounts="zoomAccounts"
		@updateStep="(step) => (view = step)"
	/>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	Dropdown,
	Switch,
	call,
	createListResource,
	toast,
} from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { computed, onMounted, ref } from 'vue'
import { cleanError } from '@/utils'
import ZoomAccountForm from '@/components/Settings/ZoomAccountForm.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const view = ref<'list' | 'form'>('list')
const currentAccount = ref<string | null>(null)

const props = defineProps<{
	label: string
	description?: string
}>()

const zoomAccounts = createListResource({
	doctype: 'LMS Zoom Settings',
	fields: [
		'name',
		'enabled',
		'account_name',
		'member',
		'member_name',
		'member_image',
		'account_id',
		'client_id',
		'client_secret',
	],
	cache: ['zoomAccounts'],
})

onMounted(() => {
	fetchZoomAccounts()
})

const fetchZoomAccounts = () => {
	zoomAccounts.reload()
}

// Grid track sizes shared by the header and every row (--list-columns).
const columns = ['minmax(0, 1fr)', 'minmax(0, 1fr)', '6.5rem', '2.25rem']

const openForm = (accountID: string) => {
	currentAccount.value = accountID
	view.value = 'form'
}

const toggleEnabled = async (row: Record<string, any>, value: boolean) => {
	// optimistic, so the switch does not lag a round trip
	const previous = row.enabled
	row.enabled = value ? 1 : 0
	try {
		await call('frappe.client.set_value', {
			doctype: 'LMS Zoom Settings',
			name: row.name,
			fieldname: 'enabled',
			value: row.enabled,
		})
	} catch (err: any) {
		row.enabled = previous
		toast.error(cleanError(err.messages?.[0] || err))
	}
}

const removeAccount = (accountID: string) => {
	zoomAccounts.delete.submit(accountID, {
		onSuccess() {
			toast.success(__('Zoom account deleted successfully'))
			fetchZoomAccounts()
		},
		onError(err: any) {
			toast.error(cleanError(err.messages?.[0] || err))
			console.error(err)
		},
	})
}
</script>
