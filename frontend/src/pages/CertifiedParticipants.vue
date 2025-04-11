<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<router-link :to="{ name: 'Batches' }">
			<Button>
				<template #prefix>
					<GraduationCap class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('Get Certified') }}
			</Button>
		</router-link>
	</header>
	<div class="p-5 lg:w-3/4 mx-auto">
		<template v-for="participant in participants.data">
			<router-link
				:to="{
					name: 'Profile',
					params: {
						username: participant.username,
					},
				}"
			>
				<div class="flex items-center space-x-3">
					<Avatar
						:image="participant.user_image"
						class="size-8 rounded-full object-contain"
						:label="participant.full_name"
						size="2xl"
					/>
					<div>
						<div>
							{{ participant.full_name }}
						</div>
						<div>
							{{ participant.headline }}
						</div>
					</div>
					<div>
						{{ participant.certificate_count }} {{ __('certificates') }}
					</div>
				</div>
			</router-link>
		</template>
	</div>
</template>
<script setup>
import {
	Avatar,
	Breadcrumbs,
	Button,
	createListResource,
	FormControl,
	Select,
	usePageMeta,
} from 'frappe-ui'
import { computed, onMounted, ref } from 'vue'
import { updateDocumentTitle } from '@/utils'
import { BookOpen, GraduationCap } from 'lucide-vue-next'
import { sessionStore } from '../stores/session'

const currentCategory = ref('')
const filters = ref({})
const nameFilter = ref('')
const { brand } = sessionStore()

onMounted(() => {
	updateParticipants()
})

const participants = createListResource({
	doctype: 'LMS Certificate',
	url: 'lms.lms.api.get_certified_participants',
	cache: ['certified_participants'],
	start: 0,
	pageLength: 30,
})

const count = call('lms.lms.api.get_count_of_certified_members').then(
	(data) => {}
)

const categories = createListResource({
	doctype: 'LMS Certificate',
	url: 'lms.lms.api.get_certification_categories',
	cache: ['certification_categories'],
	auto: true,
	transform(data) {
		data.unshift({ label: __(''), value: '' })
		return data
	},
})

const updateParticipants = () => {
	updateFilters()
	participants.update({
		filters: filters.value,
	})
	participants.reload()
}

const updateFilters = () => {
	if (currentCategory.value) {
		filters.value.category = currentCategory.value
	} else {
		delete filters.value.category
	}

	if (nameFilter.value) {
		filters.value.member_name = ['like', `%${nameFilter.value}%`]
	} else {
		delete filters.value.member_name
	}
}

const breadcrumbs = computed(() => [
	{
		label: __('Certified Participants'),
		route: { name: 'CertifiedParticipants' },
	},
])

usePageMeta(() => {
	return {
		title: __('Certified Participants'),
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
