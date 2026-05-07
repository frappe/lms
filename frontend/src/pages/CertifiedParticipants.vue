<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<router-link :to="{ name: 'Courses', query: { certification: true } }">
			<Button>
				<template #prefix>
					<GraduationCap class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('Get Certified') }}
			</Button>
		</router-link>
	</header>
	<div class="mx-auto w-full">
		<div class="flex flex-col md:flex-row justify-between mb-5 px-5 pt-5">
			<div class="text-lg font-semibold text-ink-gray-9 mb-4 md:mb-0">
				{{ memberCount }} {{ __('Certified Members') }}
			</div>
			<div
				class="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:gap-x-4"
			>
				<div class="flex items-center gap-x-4">
					<FormControl
						v-model="nameFilter"
						:placeholder="__('Search by Name')"
						type="text"
						class="min-w-40 lg:min-w-0 lg:w-32 xl:w-40"
						@input="updateParticipants()"
					/>
					<div
						v-if="categories.data?.length"
						class="min-w-40 lg:min-w-0 lg:w-32 xl:w-40"
					>
						<Select
							v-model="currentCategory"
							:options="categories.data"
							:placeholder="__('Category')"
							@update:modelValue="updateParticipants()"
						/>
					</div>
				</div>
				<div class="flex items-center gap-x-4">
					<FormControl
						v-model="openToWork"
						:label="__('Open to Work')"
						type="checkbox"
						@change="updateParticipants()"
					/>
					<FormControl
						v-model="hiring"
						:label="__('Hiring')"
						type="checkbox"
						@change="updateParticipants()"
					/>
				</div>
			</div>
		</div>
		<div
			v-if="participants.data?.length"
			class="h-[63vh] lg:h-[77vh] overflow-y-auto mb-5 px-5"
		>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
				<div
					v-for="participant in participants.data"
					class="flex flex-col border hover:border-outline-gray-3 rounded-lg p-3 text-ink-gray-9 cursor-pointer"
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
							<div class="font-semibold line-clamp-1">
								{{ participant.full_name }}
							</div>
							<div class="text-sm leading-5 line-clamp-1 mb-4">
								{{
									participant.headline ||
									'Joined ' + dayjs(participant.creation).fromNow()
								}}
							</div>
						</div>
					</div>
					<div class="mt-auto space-y-2 text-ink-gray-7">
						<div class="flex items-center gap-x-1">
							<GraduationCap class="h-4 w-4 stroke-1.5 me-1" />
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
							<Calendar class="h-4 w-4 stroke-1.5 me-1" />
							<span>{{
								dayjs(participant.issue_date).format('DD MMM YYYY')
							}}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else class="h-[40vh] lg:h-[53vh] px-5">
			<EmptyStateLayout name="Certified Members" />
		</div>
		<div class="flex items-center justify-end gap-x-3 border-t pt-3 px-5">
			<Button v-if="participants.hasNextPage" @click="participants.next()">
				{{ __('Load More') }}
			</Button>
			<div v-if="participants.hasNextPage" class="h-8 border-s"></div>
			<div class="text-ink-gray-5">
				{{ participants.data?.length }} {{ __('of') }}
				{{ memberCount }}
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	call,
	createListResource,
	FormControl,
	Select,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { GraduationCap, Calendar } from 'lucide-vue-next'
import { sessionStore } from '../stores/session'
import { useRouter } from 'vue-router'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import UserAvatar from '@/components/UserAvatar.vue'

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
