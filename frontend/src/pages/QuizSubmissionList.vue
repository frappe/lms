<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('Submissions for {0} Quiz').format(quizTitle || '…')"
		layout="list"
		:columns="columns"
		:rows="submissions.data || []"
		:loading="submissions.loading"
		:total-count="totalSubmissions.data"
		:has-next-page="submissions.hasNextPage"
		:list-options="{
			showTooltip: false,
			selectable: true,
			getRowRoute: (row) => ({
				name: 'QuizSubmission',
				params: { submission: row.name },
			}),
		}"
		v-model:page-length="pageLength"
		empty-name="Quiz Submissions"
		empty-icon="lucide-file-check"
		@load-more="submissions.next()"
	>
		<template #filters>
			<FormControl
				v-model="search"
				type="text"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
		</template>

		<template #cell="{ column, row, value }">
			<span v-if="column.key === 'score'">
				{{ row.score }} / {{ row.score_out_of }}
			</span>
			<span v-else-if="column.key === 'percentage'">
				{{ row.percentage }}%
			</span>
			<span v-else>{{ value }}</span>
		</template>

		<template #selection-actions="{ unselectAll, selections }">
			<Button
				variant="ghost"
				:label="__('Delete')"
				@click="deleteSubmissions(selections, unselectAll)"
			>
				<template #prefix>
					<span class="lucide-trash-2 size-4" />
				</template>
			</Button>
		</template>
	</ListPage>
</template>

<script setup>
import {
	createListResource,
	createResource,
	Button,
	FormControl,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { computed, onMounted, inject, ref, watch } from 'vue'
import { sessionStore } from '../stores/session'
import { useRouter } from 'vue-router'
import ListPage from '@/components/Layouts/ListPage.vue'

const { brand } = sessionStore()
const router = useRouter()
const user = inject('$user')
const dayjs = inject('$dayjs')
const search = ref('')

const props = defineProps({
	quizID: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator)
		router.push({ name: 'Courses' })
})

const submissionFilters = ref({ quiz: props.quizID })

watch(search, () => {
	submissionFilters.value = {
		quiz: props.quizID,
		member_name: ['like', `%${search.value}%`],
	}
	// A narrowed list has to be read from its first page, for the same reason
	// pageLength resets below: reload() refetches the loaded window otherwise.
	submissions.update({ filters: submissionFilters.value, start: 0 })
	submissions.reload()
	totalSubmissions.update({
		params: {
			doctype: 'LMS Quiz Submission',
			filters: submissionFilters.value,
		},
	})
	totalSubmissions.reload()
})

const submissions = createListResource({
	doctype: 'LMS Quiz Submission',
	filters: submissionFilters,
	fields: [
		'name',
		'member_name',
		'score',
		'score_out_of',
		'percentage',
		'creation',
		'quiz_title',
	],
	orderBy: 'creation desc',
	pageLength: 24,
	auto: true,
	transform(data) {
		return data.map((row) => ({
			...row,
			creation: dayjs(row.creation).format('DD MMM YYYY'),
		}))
	},
})

const pageLength = computed({
	get: () => submissions.pageLength,
	set: (value) => {
		// reload() ignores a new pageLength while start > 0: it refetches the
		// already loaded rows instead, so paging must be reset for it to apply.
		submissions.update({ pageLength: value, start: 0 })
		submissions.reload()
	},
})

const totalSubmissions = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Quiz Submission',
		filters: submissionFilters.value,
	},
	auto: true,
})

const deleteSubmissions = async (selections, unselectAll) => {
	await Promise.all(
		Array.from(selections).map((name) => submissions.delete.submit(name))
	)
	unselectAll()
	totalSubmissions.reload()
	toast.success(__('Submissions deleted successfully'))
}

const quizTitle = computed(() => submissions.data?.[0]?.quiz_title || '')

const columns = computed(() => [
	{
		label: __('Member'),
		key: 'member_name',
		width: 2,
		icon: 'lucide-user',
	},
	{
		label: __('Score'),
		key: 'score',
		width: 1,
		align: 'center',
		icon: 'lucide-hash',
	},
	{
		label: __('Percentage'),
		key: 'percentage',
		width: 0.75,
		align: 'center',
		icon: 'lucide-percent',
	},
	{
		label: __('Submitted On'),
		key: 'creation',
		width: 1,
		align: 'right',
		icon: 'lucide-clock',
	},
])

const breadcrumbs = computed(() => {
	const crumbs = [{ label: __('Quizzes'), route: { name: 'Quizzes' } }]
	if (quizTitle.value) {
		crumbs.push({
			label: quizTitle.value,
			route: { name: 'QuizForm', params: { quizID: props.quizID } },
		})
	}
	crumbs.push({ label: __('Submissions') })
	return crumbs
})

usePageMeta(() => ({
	title: __('Quiz Submissions'),
	icon: brand.favicon,
}))
</script>
