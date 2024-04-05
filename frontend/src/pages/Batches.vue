<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('All Batches'), route: { name: 'Batches' } }]"
			/>
			<div class="flex">
				<router-link
					v-if="user.data"
					:to="{
						name: 'BatchCreation',
						params: { batchName: 'new' },
					}"
				>
					<Button variant="solid">
						<template #prefix>
							<Plus class="h-4 w-4" />
						</template>
						{{ __('New Batch') }}
					</Button>
				</router-link>
			</div>
		</header>
		<div v-if="batches.data" class="pb-5">
			<div
				v-if="batches.data.length == 0 && batches.list.loading"
				class="p-5 text-base text-gray-700"
			>
				{{ __('Loading Batches...') }}
			</div>
			<Tabs
				v-model="tabIndex"
				:tabs="tabs"
				tablistClass="overflow-x-visible flex-wrap !gap-3 md:flex-nowrap"
			>
				<template #tab="{ tab, selected }">
					<div>
						<button
							class="group -mb-px flex items-center gap-2 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900"
							:class="{ 'text-gray-900': selected }"
						>
							<component v-if="tab.icon" :is="tab.icon" class="h-5" />
							{{ __(tab.label) }}
							<Badge
								:class="
									selected
										? 'text-gray-800 border border-gray-800'
										: 'border border-gray-500'
								"
								variant="subtle"
								theme="gray"
								size="sm"
							>
								{{ tab.count }}
							</Badge>
						</button>
					</div>
				</template>
				<template #default="{ tab }">
					<div
						v-if="tab.batches && tab.batches.value.length"
						class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-5 mx-5"
					>
						<router-link
							v-for="batch in tab.batches.value"
							:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
						>
							<BatchCard :batch="batch" />
						</router-link>
					</div>
					<div
						v-else
						class="grid flex-1 place-items-center text-xl font-medium text-gray-500"
					>
						<div class="flex flex-col items-center justify-center mt-4">
							<div>
								{{ __('No {0} batches found').format(tab.label.toLowerCase()) }}
							</div>
						</div>
					</div>
				</template>
			</Tabs>
		</div>
	</div>
</template>
<script setup>
import { createListResource, Breadcrumbs, Button, Tabs, Badge } from 'frappe-ui'
import { Plus } from 'lucide-vue-next'
import BatchCard from '@/components/BatchCard.vue'
import { inject, ref, computed } from 'vue'

const user = inject('$user')

const batches = createListResource({
	doctype: 'LMS Batch',
	url: 'lms.lms.utils.get_batches',
	cache: ['batches', user?.data?.email],
	auto: true,
})

const tabIndex = ref(0)
const tabs = [
	{
		label: 'Upcoming',
		batches: computed(() => batches.data?.upcoming || []),
		count: computed(() => batches.data?.upcoming?.length),
	},
]

if (user.data?.is_moderator) {
	tabs.push({
		label: 'Archived',
		batches: computed(() => batches.data?.archived),
		count: computed(() => batches.data?.archived?.length),
	})
	tabs.push({
		label: 'Private',
		batches: computed(() => batches.data?.private),
		count: computed(() => batches.data?.private?.length),
	})
}
if (user.data) {
	tabs.push({
		label: 'Enrolled',
		batches: computed(() => batches.data?.enrolled),
		count: computed(() => batches.data?.enrolled?.length),
	})
}
</script>
