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
			class="list-row-px-3"
		>
			<ListHeader>
				<ListHeaderCell>{{ __('Account') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Status') }}</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListRows
				:items="zoomAccounts.data"
				row-key="name"
				v-slot="{ item: row }"
			>
				<ListRow class="py-2.5" @click="openForm(row.name)">
					<ListCell class="gap-2">
						<Avatar
							:image="row.member_image"
							:label="row.member_name"
							size="lg"
							class="shrink-0"
						/>
						<div class="flex min-w-0 flex-col">
							<span class="truncate text-p-base-medium text-ink-gray-8">
								{{ row.member_name }}
							</span>
							<span class="truncate text-p-sm text-ink-gray-5">
								{{ row.account_id }}
							</span>
						</div>
					</ListCell>
					<ListCell>
						<Badge :theme="row.enabled ? 'green' : 'gray'">
							{{ row.enabled ? __('Enabled') : __('Disabled') }}
						</Badge>
					</ListCell>
					<ListCell class="justify-end" @click.stop>
						<Dropdown
							:options="[
								{
									label: __('Delete'),
									icon: 'lucide-trash-2',
									onClick: () => removeAccount(row.name),
								},
							]"
							:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
							placement="right"
						/>
					</ListCell>
				</ListRow>
			</ListRows>
		</List>
		<EmptyStateLayout
			v-else
			name="Zoom Settings"
			:description="__('Add one to get started.')"
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
	Badge,
	Dropdown,
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
const columns = ['minmax(0, 1fr)', '6.5rem', '2.25rem']

const openForm = (accountID: string) => {
	currentAccount.value = accountID
	view.value = 'form'
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
