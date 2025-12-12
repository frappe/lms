<template>
	<Dialog v-model="show" :options="{ size: '2xl' }">
		<template #body>
			<div class="text-base">
				<div class="flex items-center space-x-2 pl-4.5 border-b">
					<Search class="size-4 text-ink-gray-4" />
					<input
						ref="inputRef"
						type="text"
						placeholder="Search"
						class="w-full border-none bg-transparent py-3 !pl-2 pr-4.5 text-base text-ink-gray-7 placeholder-ink-gray-4 focus:ring-0"
						@input="onInput"
						v-model="query"
						autocomplete="off"
					/>
				</div>

				<div class="max-h-96 overflow-auto mb-2">
					<div v-if="query.length" class="mt-5 space-y-5">
						<CommandPaletteGroup
							:list="searchResults"
							@navigateTo="navigateTo"
						/>
					</div>

					<div v-else class="mt-5 space-y-5">
						<CommandPaletteGroup
							:list="jumpToOptions"
							@navigateTo="navigateTo"
						/>
					</div>
				</div>

				<div
					class="flex items-center space-x-5 w-full border-t py-2 text-sm text-ink-gray-7 px-4.5"
				>
					<div class="flex items-center space-x-2">
						<MoveUp
							class="size-5 stroke-1.5 bg-surface-gray-2 p-1 rounded-sm"
						/>
						<MoveDown
							class="size-5 stroke-1.5 bg-surface-gray-2 p-1 rounded-sm"
						/>
						<span>
							{{ __('to navigate') }}
						</span>
					</div>
					<div class="flex items-center space-x-2">
						<CornerDownLeft
							class="size-5 stroke-1.5 bg-surface-gray-2 p-1 rounded-sm"
						/>
						<span>
							{{ __('to select') }}
						</span>
					</div>
					<div class="flex items-center space-x-2">
						<span class="bg-surface-gray-2 p-1 rounded-sm"> esc </span>
						<span>
							{{ __('to close') }}
						</span>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { createResource, debounce, Dialog } from 'frappe-ui'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
	BookOpen,
	Briefcase,
	CornerDownLeft,
	FileSearch,
	MoveUp,
	MoveDown,
	Search,
	Users,
} from 'lucide-vue-next'
import CommandPaletteGroup from './CommandPaletteGroup.vue'

const show = defineModel<boolean>({ required: true, default: false })
const router = useRouter()
const query = ref<string>('')
const searchResults = ref<Array<any>>([])

const search = createResource({
	url: 'lms.command_palette.search_sqlite',
	makeParams: () => ({
		query: query.value,
	}),
	onSuccess() {
		generateSearchResults()
	},
})

const debouncedSearch = debounce(() => {
	if (query.value.length > 2) {
		search.reload()
	}
}, 500)

const onInput = () => {
	debouncedSearch()
}

const generateSearchResults = () => {
	search.data?.forEach((type: any) => {
		let result: { title: string; items: any[] } = { title: '', items: [] }
		result.title = type.title
		type.items.forEach((item: any) => {
			let paramName = item.doctype === 'LMS Course' ? 'courseName' : 'batchName'
			item.route = {
				name: item.doctype === 'LMS Course' ? 'CourseDetail' : 'BatchDetail',
				params: {
					[paramName]: item.name,
				},
			}
			item.isActive = false
		})
		result.items = type.items
		searchResults.value.push(result)
	})
}

const appendSearchPage = () => {
	let searchPage: { title: string; items: Array<any> } = {
		title: '',
		items: [],
	}
	searchPage.title = __('Jump to')
	searchPage.items = [
		{
			title: __('Search for ') + `"${query.value}"`,
			route: {
				name: 'Search',
				query: {
					q: query.value,
				},
			},
			icon: FileSearch,
			isActive: true,
		},
	]
	searchResults.value = [searchPage]
}

watch(
	query,
	() => {
		appendSearchPage()
	},
	{ immediate: true }
)

watch(show, () => {
	if (!show.value) {
		query.value = ''
		searchResults.value = []
	}
})

onMounted(() => {
	addKeyboardShortcuts()
})

const addKeyboardShortcuts = () => {
	window.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'ArrowUp' && show.value) {
			e.preventDefault()
			shortcutForArrowKey(-1)
		} else if (e.key === 'ArrowDown' && show.value) {
			shortcutForArrowKey(1)
		} else if (e.key === 'Enter' && show.value) {
			shortcutForEnter()
		} else if (e.key === 'Escape' && show.value) {
			show.value = false
		}
	})
}

const shortcutForArrowKey = (direction: number) => {
	let currentList = query.value.length
		? searchResults.value
		: jumpToOptions.value
	let allItems = currentList.flatMap((result: any) => result.items)
	let indexOfActive = allItems.findIndex((option: any) => option.isActive)
	let newIndex = indexOfActive + direction
	if (newIndex < 0) newIndex = allItems.length - 1
	if (newIndex >= allItems.length) newIndex = 0
	allItems[indexOfActive].isActive = false
	allItems[newIndex].isActive = true
	nextTick(scrollActiveItemIntoView)
}

const scrollActiveItemIntoView = () => {
	const activeItem = document.querySelector(
		'.hover\\:bg-surface-gray-2.bg-surface-gray-2'
	) as HTMLElement
	if (activeItem) {
		activeItem.scrollIntoView({ block: 'nearest' })
	}
}

const shortcutForEnter = () => {
	let currentList = query.value.length
		? searchResults.value
		: jumpToOptions.value
	let allItems = currentList.flatMap((result: any) => result.items)
	let activeOption = allItems.find((option) => option.isActive)
	if (activeOption) {
		navigateTo(activeOption.route)
	}
}

const navigateTo = (route: {
	name: string
	params?: Record<string, any>
	query?: Record<string, any>
}) => {
	show.value = false
	query.value = ''
	router.replace({ name: route.name, params: route.params, query: route.query })
}

const jumpToOptions = ref([
	{
		title: __('Jump to'),
		items: [
			{
				title: 'Advanced Search',
				icon: Search,
				route: {
					name: 'Search',
				},
				isActive: true,
			},
			{
				title: 'Courses',
				icon: BookOpen,
				route: {
					name: 'Courses',
				},
				isActive: false,
			},
			{
				title: 'Batches',
				icon: Users,
				route: {
					name: 'Batches',
				},
				isActive: false,
			},
			{
				title: 'Jobs',
				icon: Briefcase,
				route: {
					name: 'Jobs',
				},
				isActive: false,
			},
		],
	},
])
</script>
<style>
mark {
	background-color: theme('colors.amber.100');
	font-weight: 500;
}
</style>
