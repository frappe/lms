<template>
	<div class="flex flex-col min-h-0 text-base">
		<div class="flex items-center justify-between mb-5">
			<div class="flex flex-col space-y-2">
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ label }}
				</div>
				<!-- <div class="text-xs text-ink-gray-5">
					{{ __(description) }}
				</div> -->
			</div>
			<div class="flex items-center space-x-5">
				<Button @click="openForm('new')">
					<template #prefix>
						<Plus class="h-3 w-3 stroke-1.5" />
					</template>
					{{ __('New') }}
				</Button>
			</div>
		</div>
		<div v-if="zoomAccounts.data?.length" class="overflow-y-scroll">
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
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns">
						<template #prefix="{ item }">
							<component
								v-if="item.icon"
								:is="item.icon"
								class="h-4 w-4 stroke-1.5 ml-4"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>

				<ListRows>
					<ListRow :row="row" v-for="row in zoomAccounts.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'enabled'">
									<Badge v-if="row[column.key]" theme="blue">
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
	</div>
	<ZoomAccountModal
		v-model="showForm"
		v-model:zoomAccounts="zoomAccounts"
		:accountID="currentAccount"
	/>
</template>
<script setup lang="ts">
import {
	Button,
	Badge,
	call,
	createListResource,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
	toast,
} from 'frappe-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { cleanError } from '@/utils'
import { User } from '@/components/Settings/types'
import ZoomAccountModal from '@/components/Modals/ZoomAccountModal.vue'

const user = inject<User | null>('$user')
const showForm = ref(false)
const currentAccount = ref<string | null>(null)

const props = defineProps({
	label: String,
	description: String,
})

const zoomAccounts = createListResource({
	doctype: 'LMS Zoom Settings',
	fields: [
		'name',
		'enabled',
		'member',
		'member_name',
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
	if (!user?.data?.is_moderator && !user?.data?.is_evaluator) return

	if (!user?.data?.is_moderator) {
		zoomAccounts.update({
			filters: {
				member: user.data.name,
			},
		})
	}
	zoomAccounts.reload()
}

const openForm = (accountID: string) => {
	currentAccount.value = accountID
	showForm.value = true
}

const removeAccount = (selections, unselectAll) => {
	call('lms.lms.api.delete_documents', {
		doctype: 'LMS Zoom Settings',
		documents: Array.from(selections),
	})
		.then(() => {
			zoomAccounts.reload()
			toast.success(__('Email Templates deleted successfully'))
			unselectAll()
		})
		.catch((err) => {
			toast.error(
				cleanError(err.messages[0]) || __('Error deleting email templates')
			)
		})
}

const columns = computed(() => {
	return [
		{
			label: __('Account'),
			key: 'name',
		},
		{
			label: __('Member'),
			key: 'member_name',
		},
		{
			label: __('Status'),
			key: 'enabled',
			align: 'center',
		},
	]
})
</script>
