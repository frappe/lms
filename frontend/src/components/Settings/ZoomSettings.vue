<template>
	<SettingsLayout
		v-if="view === 'list'"
		:title="label"
		:description="__(description || '')"
	>
		<template #header-actions>
			<Button variant="solid" @click="openForm('new')">
				<template #prefix>
					<Plus class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</template>
		<div v-if="zoomAccounts.data?.length">
			<ListView
				:columns="columns"
				:rows="zoomAccounts.data"
				row-key="name"
				:options="{
					showTooltip: false,
					onRowClick: (row) => {
						openForm(row.name)
					},
				}"
			>
				<ListHeader
					class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns">
						<template #prefix="{ item }">
							<FeatherIcon
								v-if="item.icon"
								:name="item.icon"
								class="h-4 w-4 stroke-1.5"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>

				<ListRows>
					<ListRow :row="row" v-for="row in zoomAccounts.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<template #prefix>
									<div v-if="column.key == 'member_name'">
										<Avatar
											class="flex items-center"
											:image="row['member_image']"
											:label="item"
											size="sm"
										/>
									</div>
								</template>
								<div v-if="column.key == 'enabled'">
									<Badge v-if="row[column.key]" theme="green">
										{{ __('Enabled') }}
									</Badge>
									<Badge v-else theme="gray">
										{{ __('Disabled') }}
									</Badge>
								</div>
								<div v-else class="leading-5 text-sm">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>

				<ListSelectBanner>
					<template #actions="{ unselectAll, selections }">
						<div class="flex gap-2">
							<Button
								variant="ghost"
								@click="removeAccount(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
		<EmptyStateLayout
			v-else
			name="Zoom Settings"
			:description="__('Add one to get started.')"
			:icon="Video"
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
	Badge,
	createListResource,
	FeatherIcon,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
	toast,
} from 'frappe-ui'
import { computed, onMounted, ref } from 'vue'
import { Plus, Trash2, Video } from 'lucide-vue-next'
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

const openForm = (accountID: string) => {
	currentAccount.value = accountID
	view.value = 'form'
}

const removeAccount = (selections: Set<string>, unselectAll: () => void) => {
	Array.from(selections).forEach((accountID) => {
		zoomAccounts.delete.submit(accountID, {
			onSuccess() {
				toast.success(__('Zoom account deleted successfully'))
				fetchZoomAccounts()
				unselectAll()
			},
			onError(err: any) {
				toast.error(cleanError(err.messages[0] || err))
				console.error(err)
			},
		})
	})
}

const columns = computed(() => {
	return [
		{
			label: __('Member'),
			key: 'member_name',
			icon: 'user',
		},
		{
			label: __('Account Name'),
			key: 'name',
			icon: 'video',
		},
		{
			label: __('Status'),
			key: 'enabled',
			align: 'center',
			icon: 'check-square',
		},
	]
})
</script>
