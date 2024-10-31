<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Batches'), route: { name: 'Batches' } }]"
			/>
			<div class="flex space-x-2">
				<div class="w-44">
					<Select
						v-if="categories.data?.length"
						v-model="currentCategory"
						:options="categories.data"
						:placeholder="__('Category')"
					/>
				</div>
				<router-link
					v-if="user.data?.is_moderator"
					:to="{
						name: 'BatchForm',
						params: { batchName: 'new' },
					}"
				>
					<Button variant="solid">
						<template #prefix>
							<Plus class="h-4 w-4 stroke-1.5" />
						</template>
						{{ __('New') }}
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
				v-if="hasBatches"
				v-model="tabIndex"
				:tabs="makeTabs"
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
						class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 m-5"
					>
						<router-link
							v-for="batch in tab.batches.value"
							:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
						>
							<BatchCard :batch="batch" />
						</router-link>
					</div>
					<div v-else class="p-5 italic text-gray-500">
						{{ __('No {0} batches').format(tab.label.toLowerCase()) }}
					</div>
				</template>
			</Tabs>
			<div
				v-else-if="
					!batches.loading &&
					!hasBatches &&
					(user.data?.is_instructor || user.data?.is_moderator)
				"
				class="grid grid-cols-3 p-5"
			>
				<router-link
					:to="{
						name: 'BatchForm',
						params: {
							batchName: 'new',
						},
					}"
				>
					<div class="bg-gray-50 py-32 px-5 rounded-md">
						<div class="flex flex-col items-center text-center space-y-2">
							<Plus
								class="size-10 stroke-1 text-gray-800 p-1 rounded-full border bg-white"
							/>
							<div class="font-medium">
								{{ __('Create a Batch') }}
							</div>
							<span class="text-gray-700 text-sm leading-4">
								{{ __('You can link courses and assessments to it.') }}
							</span>
						</div>
					</div>
				</router-link>
			</div>
			<div
				v-else-if="!batches.loading && !hasBatches"
				class="text-center p-5 text-gray-600 mt-52 w-3/4 md:w-1/2 mx-auto space-y-2"
			>
				<BookOpen class="size-10 mx-auto stroke-1 text-gray-500" />
				<div class="text-xl font-medium">
					{{ __('No batches found') }}
				</div>
				<div>
					{{
						__(
							'There are no batches available at the moment. Keep an eye out, fresh learning experiences are on the way soon!'
						)
					}}
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	createResource,
	Breadcrumbs,
	Button,
	Tabs,
	Badge,
	Select,
} from 'frappe-ui'
import { BookOpen, Plus } from 'lucide-vue-next'
import BatchCard from '@/components/BatchCard.vue'
import { inject, ref, computed, onMounted, watch } from 'vue'
import { updateDocumentTitle } from '@/utils'

const user = inject('$user')
const currentCategory = ref(null)
const hasBatches = ref(false)

onMounted(() => {
	let queries = new URLSearchParams(location.search)
	if (queries.has('category')) {
		currentCategory.value = queries.get('category')
	}
})

const batches = createResource({
	doctype: 'LMS Batch',
	url: 'lms.lms.utils.get_batches',
	cache: ['batches', user.data?.email],
	auto: true,
})

const categories = createResource({
	url: 'lms.lms.api.get_categories',
	makeParams() {
		return {
			doctype: 'LMS Batch',
			filters: {
				published: 1,
			},
		}
	},
	cache: ['batchCategories'],
	auto: true,
	transform(data) {
		data.unshift({
			label: '',
			value: null,
		})
	},
})

const tabIndex = ref(0)
let tabs

const makeTabs = computed(() => {
	tabs = []
	addToTabs('Upcoming')

	if (user.data?.is_moderator) {
		addToTabs('Archived')
		addToTabs('Private')
	}

	if (user.data) {
		addToTabs('Enrolled')
	}

	return tabs
})

const getBatches = (type) => {
	if (currentCategory.value && currentCategory.value != '') {
		return batches.data[type].filter(
			(batch) => batch.category == currentCategory.value
		)
	}
	return batches.data[type]
}

const addToTabs = (label) => {
	let batches = getBatches(label.toLowerCase().split(' ').join('_'))
	tabs.push({
		label,
		batches: computed(() => batches),
		count: computed(() => batches.length),
	})
}

watch(batches, () => {
	Object.keys(batches.data).forEach((key) => {
		if (batches.data[key].length) {
			hasBatches.value = true
		}
	})
})

watch(
	() => currentCategory.value,
	() => {
		let queries = new URLSearchParams(location.search)
		if (currentCategory.value) {
			queries.set('category', currentCategory.value)
		} else {
			queries.delete('category')
		}
		history.pushState(null, '', `${location.pathname}?${queries.toString()}`)
	}
)

const pageMeta = computed(() => {
	return {
		title: 'Batches',
		description: 'All batches divided by categories',
	}
})

updateDocumentTitle(pageMeta)
</script>
