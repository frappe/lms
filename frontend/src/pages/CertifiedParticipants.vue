<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:rows="rows"
		:total-count="memberCount"
		:loading="participants.list.loading"
		:has-next-page="participants.hasNextPage"
		row-key="key"
		v-model:page-length="pageLength"
		empty-name="Certified Members"
		empty-icon="lucide-badge-check"
		@load-more="participants.next()"
	>
		<template #actions>
			<router-link :to="{ name: 'Courses', query: { certification: true } }">
				<Button>
					<template #prefix>
						<span class="lucide-graduation-cap size-4" />
					</template>
					{{ __('Get Certified') }}
				</Button>
			</router-link>
		</template>

		<template #title>
			{{ memberCount }} {{ __('Certified Members') }}
		</template>

		<template #filters>
			<FormControl
				v-model="nameFilter"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
				type="text"
				class="w-full sm:min-w-40 lg:w-32 lg:min-w-0 xl:w-40"
				@input="updateParticipants()"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
			<ClearableCombobox
				v-if="categories.data?.length"
				v-model="currentCategory"
				:options="categories.data.filter((c) => c.value)"
				:placeholder="__('Category')"
				class="w-full sm:w-auto"
				@update:modelValue="updateParticipants()"
			/>
		</template>

		<template #toggles>
			<ToggleFilter
				:modelValue="openToWork"
				:label="__('Open to Work')"
				theme="green"
				@update:modelValue="setOpenToWork"
			/>
			<ToggleFilter
				:modelValue="hiring"
				:label="__('Hiring')"
				theme="blue"
				@update:modelValue="setHiring"
			/>
		</template>

		<template #card="{ row }">
			<component
				:is="row.username ? 'router-link' : 'div'"
				:to="profileRoute(row.username, 'ProfileAbout')"
				class="flex flex-col rounded-lg border p-3 text-ink-gray-9"
				:class="
					row.username ? 'cursor-pointer hover:border-outline-gray-3' : ''
				"
			>
				<div class="flex items-center gap-x-4">
					<UserAvatar :user="row" size="2xl" />
					<div class="flex flex-col">
						<div class="line-clamp-1 font-semibold">
							{{ row.full_name }}
						</div>
						<div class="mb-4 line-clamp-1 text-sm leading-5">
							{{ row.headline || 'Joined ' + dayjs(row.creation).fromNow() }}
						</div>
					</div>
				</div>
				<div class="mt-auto space-y-2 text-ink-gray-7">
					<div>
						<Badge size="lg">
							<template #prefix>
								<span class="lucide-graduation-cap size-3" />
							</template>
							{{ row.certificate_count }}
							{{
								row.certificate_count > 1
									? __('certificates')
									: __('certificate')
							}}
						</Badge>
					</div>
					<div class="flex items-center gap-x-1">
						<span class="lucide-calendar me-1 h-4 w-4" />
						<span>{{ dayjs(row.issue_date).format('DD MMM YYYY') }}</span>
					</div>
				</div>
			</component>
		</template>
	</ListPage>
</template>
<script setup>
import {
	Badge,
	Button,
	call,
	createListResource,
	FormControl,
	usePageMeta,
} from 'frappe-ui'
import ClearableCombobox from '@/components/Controls/ClearableCombobox.vue'
import ToggleFilter from '@/components/Controls/ToggleFilter.vue'
import { computed, inject, onMounted, ref } from 'vue'
import { sessionStore } from '../stores/session'
import { useRouter } from 'vue-router'
import UserAvatar from '@/components/UserAvatar.vue'
import ListPage from '@/components/Layouts/ListPage.vue'
import { profileRoute } from '@/utils/routes'

const filters = ref({})
const currentCategory = ref('')
const nameFilter = ref('')
const openToWork = ref(false)
const hiring = ref(false)
const { brand } = sessionStore()
const memberCount = ref(0)
const dayjs = inject('$dayjs')
const user = inject('$user')
const router = useRouter()

onMounted(() => {
	if (!user.data) {
		router.push({ name: 'Courses' })
		return
	}
	setFiltersFromQuery()
	updateParticipants()
})

const participants = createListResource({
	doctype: 'LMS Certificate',
	url: 'lms.lms.api.get_certified_participants',
	start: 0,
	pageLength: 24,
	cache: ['certified_participants'],
})

// get_certified_participants pops `member`, so no row carries a `name` and
// ListPage's default row key would be "undefined" for every card. `username` is
// unique on User, but Frappe leaves it blank when it collides, so fall back to
// the position to keep the keys distinct.
const rows = computed(() =>
	(participants.data || []).map((participant, index) => ({
		...participant,
		key: participant.username ? `u:${participant.username}` : `i:${index}`,
	}))
)

const pageLength = computed({
	get: () => participants.pageLength,
	set: (value) => {
		// reload() keeps the already-loaded row count when start > 0, so the new
		// page size would be ignored after a Load More unless paging resets too.
		participants.update({ pageLength: value, start: 0 })
		participants.reload()
	},
})

const getMemberCount = () => {
	call('lms.lms.api.get_count_of_certified_members', {
		filters: filters.value,
	}).then((data) => {
		memberCount.value = data
	})
}

const setOpenToWork = (value) => {
	openToWork.value = value
	updateParticipants()
}

const setHiring = (value) => {
	hiring.value = value
	updateParticipants()
}

const categories = createListResource({
	doctype: 'LMS Certificate',
	url: 'lms.lms.api.get_certification_categories',
	cache: ['certification_categories'],
	auto: user.data ? true : false,
	transform(data) {
		data.unshift({ label: __(' '), value: ' ' })
		return data
	},
})

const updateParticipants = () => {
	updateFilters()
	getMemberCount()
	setQueryParams()

	participants.update({
		filters: filters.value,
	})
	participants.reload()
}

const updateFilters = () => {
	filters.value = {
		...(currentCategory.value.trim('') && {
			category: currentCategory.value,
		}),
		...(nameFilter.value && {
			member_name: ['like', `%${nameFilter.value}%`],
		}),
		...(openToWork.value && {
			open_to_work: true,
		}),
		...(hiring.value && {
			hiring: true,
		}),
	}
}

const setQueryParams = () => {
	let queries = new URLSearchParams(location.search)
	let filterKeys = {
		category: currentCategory.value,
		name: nameFilter.value,
		'open-to-work': openToWork.value,
		hiring: hiring.value,
	}

	Object.keys(filterKeys).forEach((key) => {
		if (filterKeys[key] && hasValue(filterKeys[key])) {
			queries.set(key, filterKeys[key])
		} else {
			queries.delete(key)
		}
	})
	history.replaceState(
		{},
		'',
		`${location.pathname}${queries.size > 0 ? `?${queries.toString()}` : ''}`
	)
}

const hasValue = (value) => {
	if (typeof value === 'string') {
		return value.trim() !== ''
	}
	return true
}

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	nameFilter.value = queries.get('name') || ''
	currentCategory.value = queries.get('category') || ''
	// Read the key setQueryParams writes; `open-to-opportunities` was never
	// written, so the filter could not survive a reload.
	openToWork.value = queries.get('open-to-work') === 'true'
	hiring.value = queries.get('hiring') === 'true'
}

const breadcrumbs = computed(() => [
	{
		label: __('Certified Members'),
		route: { name: 'CertifiedParticipants' },
	},
])

usePageMeta(() => {
	return {
		title: __('Certified Members'),
		icon: brand.favicon,
	}
})
</script>
