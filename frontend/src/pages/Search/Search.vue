<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="[{ label: __('Search') }]" />
	</header>
	<div class="w-4/6 mx-auto py-5">
		<div class="px-2.5">
			<TextInput
				ref="searchInput"
				class="flex-1"
				placeholder="Search for a keyword or phrase and press enter"
				autocomplete="off"
				:model-value="query"
				@update:model-value="updateQuery"
				@keydown.enter="() => submit()"
			>
				<template #prefix>
					<Search class="w-4 text-ink-gray-5" />
				</template>
				<template #suffix>
					<div class="flex items-center">
						<button
							v-if="query"
							@click="clearSearch"
							class="p-1 size-6 grid place-content-center focus:outline-none focus:ring focus:ring-outline-gray-3 rounded"
						>
							<X class="w-4 text-ink-gray-7" />
						</button>
					</div>
				</template>
			</TextInput>
			<div
				v-if="query && searchResults.length"
				class="text-sm text-ink-gray-5 mt-2"
			>
				{{ searchResults.length }}
				{{ searchResults.length === 1 ? __('match') : __('matches') }}
			</div>
			<div v-else-if="queryChanged" class="text-sm text-ink-gray-5 mt-2">
				{{ __('Press enter to search') }}
			</div>
			<div
				v-else-if="query && !searchResults.length"
				class="text-sm text-ink-gray-5 mt-2"
			>
				{{ __('No results found') }}
			</div>
		</div>

		<div class="mt-5">
			<div v-if="searchResults.length" class="">
				<div
					v-for="(result, index) in searchResults"
					@click="navigate(result)"
					class="rounded-md cursor-pointer hover:bg-surface-gray-2 px-2"
				>
					<div
						class="flex space-x-2 py-3"
						:class="{
							'border-b': index !== searchResults.length - 1,
						}"
					>
						<Tooltip :text="result.author_info.full_name">
							<Avatar
								:label="result.author_info.full_name"
								:image="result.author_info.user_image"
								size="md"
							/>
						</Tooltip>
						<div class="space-y-1 w-full">
							<div class="flex items-center">
								<div
									class="font-medium text-ink-gray-9"
									v-html="result.title"
								></div>
								<div class="text-sm text-ink-gray-5 ml-2">
									{{ getDocTypeTitle(result.doctype) }}
								</div>
								<div
									v-if="
										result.published_on || result.start_date || result.creation
									"
									class="ml-auto text-sm text-ink-gray-5"
								>
									{{
										dayjs(
											result.published_on ||
												result.start_date ||
												result.creation
										).format('DD MMM YYYY')
									}}
								</div>
							</div>
							<div
								class="leading-5 text-ink-gray-7"
								v-html="result.content"
							></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	Avatar,
	Breadcrumbs,
	createResource,
	debounce,
	TextInput,
	Tooltip,
	usePageMeta,
} from 'frappe-ui'
import { inject, onMounted, ref, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter, useRoute } from 'vue-router'

const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const searchResults = ref<Array<any>>([])
const { brand } = sessionStore()
const router = useRouter()
const route = useRoute()
const queryChanged = ref(false)
const dayjs = inject<any>('$dayjs')

onMounted(() => {
	if (router.currentRoute.value.query.q) {
		query.value = router.currentRoute.value.query.q as string
		submit()
	}
})

const updateQuery = (value: string) => {
	query.value = value
	router.replace({ query: value ? { q: value } : {} })
}

const submit = debounce(() => {
	if (query.value.length > 2) {
		search.reload()
	}
}, 500)

const search = createResource({
	url: 'lms.command_palette.search_sqlite',
	makeParams: () => ({
		query: query.value,
	}),
	onSuccess() {
		generateSearchResults()
	},
})

const generateSearchResults = () => {
	searchResults.value = []
	if (search.data) {
		queryChanged.value = false
		search.data.forEach((group: any) => {
			group.items.forEach((item: any) => {
				searchResults.value.push(item)
			})
		})
		searchResults.value.sort((a, b) => b.score - a.score)
	}
}

const navigate = (result: any) => {
	if (result.doctype == 'LMS Course') {
		router.push({
			name: 'CourseDetail',
			params: {
				courseName: result.name,
			},
		})
	} else if (result.doctype == 'LMS Batch') {
		router.push({
			name: 'BatchDetail',
			params: {
				batchName: result.name,
			},
		})
	} else if (result.doctype == 'Job Opportunity') {
		router.push({
			name: 'JobDetail',
			params: {
				job: result.name,
			},
		})
	}
}

watch(query, () => {
	if (query.value && query.value != search.params?.query) {
		queryChanged.value = true
	} else if (!query.value) {
		queryChanged.value = false
		searchResults.value = []
	}
})

watch(
	() => route.query.q,
	(newQ) => {
		if (newQ && newQ !== query.value) {
			query.value = newQ as string
			submit()
		}
	}
)

const getDocTypeTitle = (doctype: string) => {
	if (doctype === 'LMS Course') {
		return __('Course')
	} else if (doctype === 'LMS Batch') {
		return __('Batch')
	} else if (doctype === 'Job Opportunity') {
		return __('Job')
	} else {
		return doctype
	}
}

const clearSearch = () => {
	query.value = ''
	updateQuery('')
}

usePageMeta(() => {
	return {
		title: __('Search'),
		icon: brand.favicon,
	}
})
</script>
