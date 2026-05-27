<template>
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs :items="breadcrumbs" />
		</template>
		<template #right-header>
			<router-link :to="{ name: 'Courses', query: { certification: true } }">
				<Button>
					<template #prefix>
						<GraduationCap class="size-4 stroke-1.5" />
					</template>
					{{ __('Get Certified') }}
				</Button>
			</router-link>
		</template>
	</LayoutHeader>
	<div class="mx-auto flex min-h-0 w-full flex-1 flex-col">
		<div class="mb-5 flex flex-col justify-between px-5 pt-5 md:flex-row">
			<div class="mb-4 text-lg font-semibold text-ink-gray-9 md:mb-0">
				{{ memberCount }} {{ __('Certified Members') }}
			</div>
			<div
				class="flex flex-col space-y-4 md:flex-row md:items-center md:gap-x-4 md:space-y-0"
			>
				<div class="flex items-center gap-x-4">
					<FormControl
						v-model="nameFilter"
						:placeholder="__('Search by Name')"
						type="text"
						class="min-w-40 lg:w-32 lg:min-w-0 xl:w-40"
						@input="updateParticipants()"
					/>
					<Select
						v-if="categories.data?.length"
						v-model="currentCategory"
						:options="categories.data"
						:placeholder="__('Category')"
						@update:modelValue="updateParticipants()"
					/>
				</div>
				<div class="flex items-center gap-x-4">
					<Checkbox
						v-model="openToWork"
						:label="__('Open to Work')"
						@change="updateParticipants()"
					/>
					<Checkbox
						v-model="hiring"
						:label="__('Hiring')"
						@change="updateParticipants()"
					/>
				</div>
			</div>
		</div>
		<div
			v-if="participants.data?.length"
			class="flex-1 overflow-y-auto px-5 pb-5"
		>
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
				<div
					v-for="participant in participants.data"
					class="flex cursor-pointer flex-col rounded-lg border p-3 text-ink-gray-9 hover:border-outline-gray-3"
					@click="
						router.push({
							name: 'ProfileAbout',
							params: { username: participant.username },
						})
					"
				>
					<div class="flex items-center gap-x-4">
						<UserAvatar :user="participant" size="2xl" />
						<div class="flex flex-col">
							<div class="line-clamp-1 font-semibold">
								{{ participant.full_name }}
							</div>
							<div class="mb-4 line-clamp-1 text-sm leading-5">
								{{
									participant.headline ||
									'Joined ' + dayjs(participant.creation).fromNow()
								}}
							</div>
						</div>
					</div>
					<div class="mt-auto space-y-2 text-ink-gray-7">
						<div class="flex items-center gap-x-1">
							<GraduationCap class="me-1 h-4 w-4 stroke-1.5" />
							<span>
								{{ participant.certificate_count }}
								{{
									participant.certificate_count > 1
										? __('certificates')
										: __('certificate')
								}}
							</span>
						</div>
						<div class="flex items-center gap-x-1">
							<Calendar class="me-1 h-4 w-4 stroke-1.5" />
							<span>{{
								dayjs(participant.issue_date).format('DD MMM YYYY')
							}}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else class="flex min-h-0 flex-1 items-center justify-center px-5">
			<EmptyStateLayout name="Certified Members" />
		</div>
		<ListFooter
			v-model="pageLength"
			class="border-t px-3 py-2 sm:px-5"
			:options="{
				rowCount: participants.data?.length,
				totalCount: memberCount,
				pageLengthOptions: [40, 80, 160],
			}"
		>
			<template #right>
				<div class="flex items-center">
					<Button
						v-if="participants.hasNextPage"
						:label="__('Load More')"
						@click="participants.next()"
					/>
					<div v-if="participants.hasNextPage" class="mx-3 h-[80%] border-l" />
					<div class="flex items-center gap-1 text-base text-ink-gray-5">
						<div>{{ participants.data?.length || 0 }}</div>
						<div>{{ __('of') }}</div>
						<div>{{ memberCount || 0 }}</div>
					</div>
				</div>
			</template>
		</ListFooter>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	call,
	createListResource,
	FormControl,
	ListFooter,
	usePageMeta,
	Checkbox,
} from 'frappe-ui'
import Select from '@/components/Controls/Select.vue'
import { computed, inject, onMounted, ref } from 'vue'
import { GraduationCap, Calendar } from 'lucide-vue-next'
import { sessionStore } from '../stores/session'
import { useRouter } from 'vue-router'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'

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
	pageLength: 40,
	cache: ['certified_participants'],
})

const pageLength = computed({
	get: () => participants.pageLength,
	set: (value) => {
		participants.update({ pageLength: value })
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
	openToWork.value = queries.get('open-to-opportunities') === 'true'
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
<style>
.headline {
	display: -webkit-box;
	-webkit-line-clamp: 1;
	-webkit-box-orient: vertical;
	text-overflow: ellipsis;
	width: 100%;
	overflow: hidden;
}
</style>
