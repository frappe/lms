<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="[{ label: __('Search') }]" />
	</header>
	<div class="w-3/4 mx-auto py-5">
		<div class="px-2.5">
			<TextInput
				ref="searchInput"
				class="flex-1"
				placeholder="Search for a keyword or phrase and press enter"
				autocomplete="off"
				:model-value="query"
				@update:model-value="updateQuery"
				@keydown="newSearch = true"
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
			<div v-if="query" class="text-sm text-ink-gray-5 mt-2">
				{{ searchResults.length }}
				{{ searchResults.length === 1 ? __('match') : __('matches') }}
			</div>
		</div>

		<div class="mt-5">
			<div v-if="searchResults.length" class="divide-y">
				<div
					v-for="result in searchResults"
					@click="navigate(result)"
					class="flex space-x-2 hover:bg-surface-gray-2 rounded-md cursor-pointer px-2.5 py-3"
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
							<div class="font-medium" v-html="result.title"></div>
							<div class="text-sm text-ink-gray-5 ml-2">
								{{ result.doctype == 'LMS Course' ? 'Course' : 'Batch' }}
							</div>
							<div
								v-if="result.published_on || result.start_date"
								class="ml-auto text-sm text-ink-gray-5"
							>
								{{
									dayjs(result.published_on || result.start_date).format(
										'DD MMM YYYY'
									)
								}}
							</div>
						</div>
						<div class="leading-5" v-html="result.content"></div>
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
import { inject, onMounted, ref } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'

const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const newSearch = ref(false)
const searchResults = ref<Array<any>>([])
const { brand } = sessionStore()
const router = useRouter()
const dayjs = inject<any>('$dayjs')

onMounted(() => {
	if (router.currentRoute.value.query.q) {
		query.value = router.currentRoute.value.query.q as string
		searchInput.value.el.focus()
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
		search.data.forEach((group: any) => {
			group.items.forEach((item: any) => {
				searchResults.value.push(item)
			})
		})
		// sort Search results by item.score descending
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
	}
}

const clearSearch = () => {
	query.value = ''
	searchInput.value?.focus()
}

usePageMeta(() => {
	return {
		title: __('Search'),
		icon: brand.favicon,
	}
})
</script>
