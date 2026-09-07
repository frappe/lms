<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('{0} Quizzes').format(totalQuizzes.data || 0)"
		layout="list"
		:columns="quizColumns"
		:rows="quizzes.data || []"
		:list-options="listOptions"
		:total-count="totalQuizzes.data ?? 0"
		:loading="quizzes.list.loading"
		:has-next-page="quizzes.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Quizzes"
		empty-icon="lucide-circle-help"
		@load-more="quizzes.next()"
	>
		<template #actions>
			<Button v-if="!readOnlyMode" variant="solid" @click="createQuiz">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>

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
			<Checkbox
				v-if="column.key == 'show_answers'"
				:modelValue="Boolean(value)"
				:disabled="true"
			/>
			<div v-else-if="column.key == 'modified'" class="text-sm text-ink-gray-5">
				{{ value }}
			</div>
			<div v-else>{{ value }}</div>
		</template>

		<template #selection-actions="{ selections }">
			<span class="sr-only" role="status">{{ deleteAnnouncement }}</span>
			<Button
				variant="ghost"
				:label="deleting ? __('Deleting…') : __('Delete')"
				:aria-disabled="deleting"
				:class="deleting ? 'cursor-not-allowed' : ''"
				@click="deleteQuiz(selections)"
			>
				<template #icon>
					<span
						class="lucide-trash-2 size-4"
						:class="deleting ? 'opacity-60' : ''"
						aria-hidden="true"
					/>
				</template>
			</Button>
		</template>
	</ListPage>
</template>
<script setup>
import {
	Button,
	call,
	Checkbox,
	createListResource,
	createResource,
	FormControl,
	toast,
	usePageMeta,
} from 'frappe-ui'
import ListPage from '@/components/Layouts/ListPage.vue'
import { useRouter } from 'vue-router'
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'

import { sessionStore } from '@/stores/session'
import { useTelemetry } from 'frappe-ui/frappe'

const { brand } = sessionStore()
const { capture } = useTelemetry()
const user = inject('$user')
const dayjs = inject('$dayjs')
const router = useRouter()
const search = ref('')
const readOnlyMode = window.read_only_mode
const quizFilters = ref({})

onMounted(() => {
	if (
		!user.data?.is_moderator &&
		!user.data?.is_instructor &&
		!user.data?.is_evaluator
	) {
		router.push({ name: 'Courses' })
	}
})

watch(search, () => {
	quizFilters.value['title'] = ['like', `%${search.value}%`]
	quizzes.update({
		filters: quizFilters.value,
	})
	quizzes.reload()
	totalQuizzes.update({
		filters: quizFilters.value,
	})
	totalQuizzes.reload()
})

const quizzes = createListResource({
	doctype: 'LMS Quiz',
	filters: quizFilters,
	fields: [
		'name',
		'title',
		'passing_percentage',
		'total_marks',
		'show_answers',
		'max_attempts',
		'modified',
	],
	auto: true,
	cache: ['quizzes', user.data?.name],
	orderBy: 'modified desc',
	pageLength: 24,
	transform(data) {
		return data.map((quiz) => {
			return {
				...quiz,
				modified: dayjs(quiz.modified).format('DD MMM YYYY'),
			}
		})
	},
})

const pageLength = computed({
	get: () => quizzes.pageLength,
	set: (value) => {
		// reload() ignores a new pageLength while start > 0: it refetches the
		// already loaded rows instead, so paging must be reset for it to apply.
		quizzes.update({ pageLength: value, start: 0 })
		quizzes.reload()
	},
})

const listOptions = computed(() => ({
	showTooltip: false,
	selectable: true,
	getRowRoute: (row) => ({
		name: 'QuizForm',
		params: { quizID: row.name },
	}),
}))

const totalQuizzes = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Quiz',
		filters: quizFilters.value,
	},
	auto: true,
	cache: ['quizzes_count', user.data?.name],
	onError(err) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
})

const createQuiz = () => {
	quizzes.insert.submit(
		{
			title: __('Untitled Quiz'),
		},
		{
			onSuccess(data) {
				capture('quiz_created')
				router.push({
					name: 'QuizForm',
					params: {
						quizID: data.name,
					},
				})
			},
			onError(error) {
				toast.error(__('Error creating quiz: {0}').format(error.message))
			},
		}
	)
}

// Frappe puts the readable half of a server error in `messages`; `message`
// carries a network or client failure. Matches the reading at `totalQuizzes`.
const errorMessage = (error) => error?.messages?.[0] || error?.message || error

// Drives the trigger's `aria-disabled` as well as the guard below. Not the
// native `disabled` attribute: that blurs the element it is set on, and the
// banner is where the keyboard already is.
const deleting = ref(false)

// The trigger renders as its icon alone — frappe-ui reads `label` into
// `aria-label` and never into the page — so the in-flight state reaches sighted
// users as a dimmed icon and everyone else through here. A changed
// `aria-label` on the focused button is not reliably re-read, and
// `aria-disabled` says the trigger is inert, not that anything is happening.
const deleteAnnouncement = computed(() =>
	deleting.value ? __('Deleting quizzes…') : ''
)

// One request per row, all in flight together, then a single refetch. Going
// through `quizzes.delete` refetches the whole page inside every success, so
// awaiting them in turn was 2N serialised round trips with nothing on screen
// to say so. `call` carries no shared loading/error state, which is the only
// thing sequential deletes were protecting.
const deleteQuiz = async (selections) => {
	// A run holds the banner up for its whole duration, so a second tap is easy
	// to make. It would resubmit names that have already gone — every one 404s,
	// and the run then reports failure for deletes that worked.
	if (deleting.value) return

	const names = Array.from(selections)
	if (!names.length) return

	deleting.value = true
	let results
	try {
		results = await Promise.allSettled(
			names.map((name) =>
				call('frappe.client.delete', { doctype: 'LMS Quiz', name })
			)
		)
	} finally {
		deleting.value = false
	}

	const failed = []
	let firstError
	results.forEach((result, index) => {
		const name = names[index]
		if (result.status === 'rejected') {
			failed.push(name)
			firstError = firstError ?? result.reason
			console.error('Error deleting quiz:', result.reason)
			return
		}
		// Only the rows that went. The banner's slot offers all-or-nothing, so
		// this prunes ListView's own selection — the set `toggleRow` deletes
		// from — one key at a time, and a failed row stays ticked to retry from.
		selections.delete(name)
	})

	const deleted = names.length - failed.length

	if (deleted) {
		// Nothing refetches on its own now that `quizzes.delete` is not what
		// deletes. `reload()` rather than `list.fetch()`: past the first page
		// the latter appends the refetch onto the rows it just refetched.
		quizzes.reload()
		// The heading's count is a separate resource and would otherwise keep
		// naming the page after the number of quizzes there used to be.
		totalQuizzes.reload()
	}

	// Pruning the selection writes the list's own `role="status"`. Two polite
	// regions mutated in one flush is a dropped or doubled announcement, and
	// the toast is inserted on a tick of its own, so JS call order alone does
	// not separate them.
	await nextTick()

	if (!failed.length) {
		toast.success(
			deleted === 1
				? __('Quiz deleted successfully')
				: __('{0} quizzes deleted successfully').format(deleted)
		)
		return
	}

	// Errors here ask the moderator to decide what to do next, and there is no
	// way to re-read a toast that has gone; the close button is already on.
	const stay = { duration: Infinity }
	if (!deleted) {
		toast.error(
			(names.length === 1
				? __('Error deleting quiz: {0}')
				: __('Error deleting quizzes: {0}')
			).format(errorMessage(firstError)),
			stay
		)
		return
	}

	toast.error(
		__('{0} of {1} quizzes deleted; the rest remain selected: {2}').format(
			deleted,
			names.length,
			errorMessage(firstError)
		),
		stay
	)
}

const quizColumns = computed(() => {
	return [
		{
			label: __('Title'),
			key: 'title',
			width: 2,
			icon: 'lucide-file-text',
		},
		{
			label: __('Total Marks'),
			key: 'total_marks',
			hideOnMobile: true,
			width: 0.5,
			align: 'left',
			icon: 'lucide-hash',
		},
		{
			label: __('Passing Percentage'),
			key: 'passing_percentage',
			hideOnMobile: true,
			width: 1,
			align: 'left',
			icon: 'lucide-percent',
		},
		{
			label: __('Max Attempts'),
			key: 'max_attempts',
			hideOnMobile: true,
			width: 0.5,
			align: 'left',
			icon: 'lucide-repeat',
		},
		{
			label: __('Show Answers'),
			key: 'show_answers',
			hideOnMobile: true,
			width: 0.5,
			align: 'left',
			icon: 'lucide-eye',
		},
		{
			label: __('Updated On'),
			key: 'modified',
			width: 1,
			align: 'left',
			icon: 'lucide-clock',
		},
	]
})

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Quizzes'),
			route: {
				name: 'Quizzes',
			},
		},
	]
})

usePageMeta(() => {
	return {
		title: __('Quizzes'),
		icon: brand.favicon,
	}
})
</script>
