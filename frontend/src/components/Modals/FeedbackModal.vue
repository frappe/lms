<template>
	<DefineContent>
		<div class="flex min-h-0 flex-1">
			<div
				v-show="!isNarrow || !showDetail"
				class="flex min-w-0 flex-1 flex-col md:w-[540px] md:flex-none md:border-e md:border-outline-gray-1"
			>
				<div v-if="config.average !== undefined" class="px-6">
					<RatingSummary
						:average="config.average"
						:reviews="summary.responses"
					/>
				</div>
				<div
					v-else
					class="grid gap-3 px-6"
					:class="config.cards.length === 3 ? 'grid-cols-3' : 'grid-cols-2'"
				>
					<NumberCard
						v-for="card in config.cards"
						:key="card.title"
						:title="card.title"
						:value="card.value"
						:format="card.isAverage ? oneDecimal : undefined"
					>
						<template v-if="card.isAverage" #title-suffix>
							<span
								class="lucide-star size-3.5 text-ink-yellow-5"
								aria-hidden="true"
							/>
						</template>
					</NumberCard>
				</div>

				<div class="px-6 pb-2 pt-4">
					<TabButtons
						v-model="filter"
						:options="filterOptions"
						:aria-label="config.labels.filter"
						class="!w-fit"
					>
						<template #suffix="{ button }">
							<span class="tabular-nums text-ink-gray-6">
								{{
									button.value === 'low'
										? summary.low_responses
										: summary.responses
								}}
							</span>
						</template>
					</TabButtons>
				</div>

				<div
					ref="listScroller"
					class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
				>
					<div v-if="loadError && !rows.length" class="flex h-full">
						<LoadError compact :error="loadError" @retry="reload" />
					</div>
					<div
						v-else-if="!loaded || (list.loading && !rows.length)"
						class="flex flex-col"
						aria-hidden="true"
					>
						<div
							v-for="row in 5"
							:key="row"
							class="flex gap-3 border-b border-outline-gray-1 px-3 py-3"
						>
							<Skeleton class="size-7 shrink-0 rounded-full" />
							<div class="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
								<Skeleton class="h-2 w-32 rounded-full" />
								<Skeleton class="h-2 w-full rounded-full" />
								<Skeleton class="h-2 w-3/4 rounded-full" />
							</div>
							<Skeleton
								v-for="score in config.scores"
								:key="score.key"
								class="mx-5 mt-1 h-2 w-12 shrink-0 rounded-full max-sm:hidden"
							/>
						</div>
					</div>
					<p
						v-else-if="!rows.length"
						class="px-3 py-10 text-center text-[13px] text-ink-gray-6"
					>
						{{
							filter === 'low' ? __('No low ratings yet.') : config.labels.empty
						}}
					</p>
					<List
						v-else
						v-model:active="activeResponse"
						:columns="responseColumns"
						class="list-row-px-3"
						:aria-label="config.labels.list"
					>
						<ListHeader
							class="sticky top-0 z-10"
							:class="isMobile ? 'bg-surface-base' : 'bg-surface-elevation-1'"
						>
							<ListHeaderCell>{{ __('Student and comment') }}</ListHeaderCell>
							<ListHeaderCell
								v-for="score in config.scores"
								:key="score.key"
								class="justify-center max-sm:hidden"
							>
								{{ score.label }}
							</ListHeaderCell>
						</ListHeader>
						<ListRows :items="rows" v-slot="{ item: row, index, value }">
							<ListRow
								:value="value"
								:data-response="row.name"
								class="py-3"
								@click="select(index)"
							>
								<ListCell class="gap-3 !items-start">
									<Avatar
										class="shrink-0"
										:image="row.member_image ?? undefined"
										:label="row.member_name"
										size="lg"
									/>
									<span class="flex min-w-0 flex-col gap-0.5">
										<span class="flex items-baseline gap-2">
											<span
												class="truncate text-[14px] font-medium text-ink-gray-8"
											>
												{{ row.member_name }}
											</span>
											<span class="shrink-0 text-[12px] text-ink-gray-6">
												{{ timeAgo(row.creation) }}
											</span>
										</span>
										<span
											class="line-clamp-2 h-[3em] text-[13px] leading-[1.5]"
											:class="
												row.feedback ? 'text-ink-gray-7' : 'text-ink-gray-6'
											"
										>
											{{ row.feedback || __('No comment') }}
										</span>
										<span class="flex gap-4 pt-1 sm:hidden">
											<FeedbackScore
												v-for="score in config.scores"
												:key="score.key"
												:field="score.key"
												:label="score.label"
												:stars="starsOf(row, score.key)"
											/>
										</span>
									</span>
								</ListCell>
								<ListCell
									v-for="score in config.scores"
									:key="score.key"
									class="justify-center self-start pt-0.5 max-sm:hidden"
								>
									<FeedbackScore
										:field="score.key"
										:label="score.label"
										:stars="starsOf(row, score.key)"
									/>
								</ListCell>
							</ListRow>
						</ListRows>
					</List>
				</div>
			</div>

			<section
				v-show="!isNarrow || showDetail"
				class="flex min-w-0 flex-1 flex-col"
				:aria-label="config.labels.item"
			>
				<div v-if="isNarrow && !isMobile" class="px-4">
					<Button
						size="sm"
						variant="ghost"
						icon-left="lucide-arrow-left"
						class="rtl:[&_span]:rotate-180"
						@click="closeDetail"
					>
						{{ config.labels.list }}
					</Button>
				</div>

				<div
					v-if="selected"
					class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-7 pt-1"
				>
					<div class="flex flex-col gap-6">
						<div class="flex items-center gap-3">
							<Avatar
								:image="selected.member_image ?? undefined"
								:label="selected.member_name"
								size="2xl"
							/>
							<div class="flex min-w-0 flex-col">
								<h3
									ref="detailHeading"
									tabindex="-1"
									class="truncate text-[16px] font-semibold text-ink-gray-8 focus:outline-none"
								>
									{{ selected.member_name }}
								</h3>
								<Tooltip :text="dayjs(selected.creation).format('LLL')">
									<span class="w-fit text-[13px] text-ink-gray-6">
										{{ __('Submitted {0}').format(timeAgo(selected.creation)) }}
									</span>
								</Tooltip>
							</div>
						</div>

						<div
							v-if="config.scores.length === 1"
							class="flex items-center gap-2"
							data-single-score
						>
							<template v-if="starsOf(selected, config.scores[0].key)">
								<Rating
									:model-value="starsOf(selected, config.scores[0].key)"
									:step="0.5"
									:disabled="true"
									aria-hidden="true"
								/>
								<span
									class="text-[14px] font-semibold tabular-nums text-ink-gray-8"
								>
									{{ starsOf(selected, config.scores[0].key) }}
								</span>
								<span class="text-[13px] text-ink-gray-6">/ 5</span>
							</template>
							<span v-else class="text-[13px] text-ink-gray-6">
								{{ __('Not rated') }}
							</span>
						</div>
						<dl
							v-else
							class="grid grid-cols-3 gap-1 rounded-[12px] bg-surface-gray-1 p-1"
						>
							<div
								v-for="score in config.scores"
								:key="score.key"
								class="flex min-w-0 flex-col gap-1 rounded-[8px] px-3 py-2"
							>
								<dt class="truncate text-[12px] text-ink-gray-6">
									{{ score.label }}
								</dt>
								<dd
									class="flex items-baseline gap-1 text-[16px] font-semibold tabular-nums text-ink-gray-8"
								>
									<template v-if="starsOf(selected, score.key)">
										<span
											class="lucide-star size-3.5 self-center text-ink-yellow-5"
											aria-hidden="true"
										/>
										{{ starsOf(selected, score.key) }}
										<span class="text-[13px] font-normal text-ink-gray-6">
											/ 5
										</span>
									</template>
									<span v-else class="text-[13px] font-normal text-ink-gray-6">
										{{ __('Not rated') }}
									</span>
								</dd>
							</div>
						</dl>

						<div class="flex flex-col gap-2">
							<h4 class="text-[14px] font-semibold text-ink-gray-8">
								{{ __('Comment') }}
							</h4>
							<p
								v-if="selected.feedback"
								class="whitespace-pre-wrap break-words text-[14px] leading-[1.6] text-ink-gray-8"
							>
								{{ selected.feedback }}
							</p>
							<p v-else class="text-[14px] text-ink-gray-6">
								{{ __('No comment') }}
							</p>
						</div>
					</div>
				</div>
				<p v-else class="m-auto px-6 text-[13px] text-ink-gray-6">
					{{ config.labels.select }}
				</p>
			</section>
		</div>

		<footer
			class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-outline-gray-1 px-6 py-3"
		>
			<template v-if="loaded && (!isNarrow || !showDetail)">
				<span class="text-[13px] text-ink-gray-6" aria-live="polite">
					{{ __('Showing {0} of {1}').format(rows.length, total) }}
				</span>
				<Button
					v-if="hasMore"
					size="sm"
					variant="subtle"
					:loading="list.loading"
					@click="loadMore"
				>
					{{ __('Load more') }}
				</Button>
			</template>
			<div class="ms-auto flex items-center gap-2">
				<template v-if="selected && (!isNarrow || showDetail)">
					<span
						class="text-[13px] tabular-nums text-ink-gray-6"
						data-testid="response-position"
					>
						{{ __('{0} of {1}').format(selectedIndex + 1, total) }}
					</span>
					<Button
						size="sm"
						variant="ghost"
						icon="lucide-chevron-left"
						class="rtl:[&_span]:rotate-180"
						:aria-label="config.labels.previous"
						:disabled="selectedIndex <= 0"
						@click="select(selectedIndex - 1)"
					/>
					<Button
						size="sm"
						variant="ghost"
						icon="lucide-chevron-right"
						class="rtl:[&_span]:rotate-180"
						:aria-label="config.labels.next"
						:disabled="selectedIndex >= total - 1 || list.loading"
						@click="selectNext"
					/>
				</template>
				<Button
					v-if="!isMobile && (!isNarrow || !showDetail)"
					size="sm"
					variant="subtle"
					icon-left="lucide-download"
					:loading="exporting"
					:disabled="!total"
					@click="exportCsv"
				>
					{{ __('Export CSV') }}
				</Button>
			</div>
		</footer>
	</DefineContent>
	<Dialog v-if="!isMobile" v-model:open="show" size="5xl" bare>
		<div
			data-feedback-sheet
			class="flex h-[min(700px,calc(100vh-96px))] flex-col text-ink-gray-8"
		>
			<header class="flex shrink-0 items-center gap-3 pb-4 pe-4 ps-6 pt-6">
				<Dialog.Title
					class="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink-gray-8"
				>
					{{ config.title }}
				</Dialog.Title>
				<Dialog.Close as-child>
					<Button
						size="sm"
						variant="ghost"
						icon="lucide-x"
						:aria-label="__('Close')"
					/>
				</Dialog.Close>
			</header>
			<ReuseContent />
		</div>
	</Dialog>
	<MobilePage
		v-else-if="show"
		:title="config.title"
		body-class="flex flex-col"
		@close="back"
	>
		<template v-if="!showDetail" #actions>
			<HeaderButton
				icon="lucide-download"
				:label="__('Export CSV')"
				:loading="exporting"
				:disabled="!total"
				@click="exportCsv"
			/>
		</template>
		<div
			data-feedback-sheet
			class="flex min-h-0 flex-1 flex-col pt-4 text-ink-gray-8"
		>
			<ReuseContent />
		</div>
	</MobilePage>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
	Avatar,
	Button,
	Dialog,
	Rating,
	Skeleton,
	TabButtons,
	Tooltip,
	createResource,
} from 'frappe-ui'
import { NumberCard } from 'frappe-ui/charts'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { createReusableTemplate } from '@vueuse/core'
import dayjs from '@/utils/dayjs'
import { timeAgo } from '@/utils/format'
import { useScreenSize } from '@/utils/composables'
import FeedbackScore from '@/components/FeedbackScore.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import LoadError from '@/components/LoadError.vue'
import MobilePage from '@/components/MobilePage.vue'
import RatingSummary from '@/components/RatingSummary.vue'
import { downloadCsv } from '@/utils/dashboard/export'
import type { FeedbackModalConfig, FeedbackRow, FeedbackTotals } from '@/types'

type Filter = 'all' | 'low'

const PAGE_LENGTH = 20

// Averages always carry one decimal, so 4 reads 4.0 beside 4.2.
const oneDecimal = (value: number) => value.toFixed(1)

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
	config: FeedbackModalConfig
	summary: FeedbackTotals
	/** The response to open with; the newest when null. */
	initialResponse?: string | null
}>()

// Below md the two panes take turns, as the student sheets stack theirs.
const NARROW = 768
const { size, isMobile } = useScreenSize()
const isNarrow = computed(() => size.width < NARROW)

// On a phone the dialog is a page, whose Back leaves a response for the list.
const [DefineContent, ReuseContent] = createReusableTemplate()

const filter = ref<Filter>('all')
const rows = ref<FeedbackRow[]>([])
const selectedIndex = ref(0)
// On a phone the two panes take turns; this says which one is showing.
const showDetail = ref(false)
const exporting = ref(false)
const listScroller = ref<HTMLElement | null>(null)
const detailHeading = ref<HTMLElement | null>(null)

const list = createResource({
	url: props.config.url,
	method: 'GET',
}) as {
	loading: boolean
	submit: (params: Record<string, unknown>) => Promise<FeedbackRow[]>
}

// One column on a phone, where the ratings fold under the comment.
const responseColumns = computed(() => ({
	base: ['minmax(0,1fr)'],
	sm: ['minmax(0,1fr)', ...props.config.scores.map(() => '5.5rem')],
}))

const starsOf = (row: FeedbackRow, key: string) => Number(row[key]) || 0

const filterOptions = computed(() => [
	{ label: __('All'), value: 'all' },
	{ label: __('Low ratings'), value: 'low' },
])

const total = computed(() =>
	filter.value === 'low' ? props.summary.low_responses : props.summary.responses
)
const hasMore = computed(() => rows.value.length < total.value)
const selected = computed<FeedbackRow | null>(
	() => rows.value[selectedIndex.value] ?? null
)

// The List highlights this row. A row's click selects it (select below), so
// the setter has nothing to add; on a phone the response replaces the list.
const activeResponse = computed({
	get: () => (isNarrow.value ? undefined : selected.value?.name),
	set: () => {},
})

function fetchPage(start: number, pageLength: number) {
	return list.submit({
		...props.config.params,
		low_only: filter.value === 'low',
		start,
		page_length: pageLength,
	})
}

// Switching the filter while a page loads starts another request; whichever
// answers last must not put the old filter's rows under the new one.
let loads = 0
// Whether this opening's first page has arrived, and why the last load failed.
const loaded = ref(false)
const loadError = ref<unknown>(null)

// The rows on screen stay until the new filter's page arrives, so switching
// filters swaps the list in one step instead of blanking it first.
async function reload() {
	const load = ++loads
	loadError.value = null
	let page: FeedbackRow[]
	try {
		page = (await fetchPage(0, PAGE_LENGTH)) ?? []
	} catch (error) {
		if (load !== loads) return
		// The old filter's rows would read as this one's; the error says why.
		loadError.value = error
		rows.value = []
		selectedIndex.value = 0
		return
	}
	if (load !== loads) return
	loaded.value = true
	rows.value = page
	selectedIndex.value = 0
	if (listScroller.value) listScroller.value.scrollTop = 0
}

async function loadMore() {
	const load = loads
	const page = (await fetchPage(rows.value.length, PAGE_LENGTH)) ?? []
	if (load === loads) rows.value = [...rows.value, ...page]
}

function select(index: number) {
	selectedIndex.value = index
	if (isNarrow.value && !showDetail.value) {
		showDetail.value = true
		nextTick(() => detailHeading.value?.focus())
	}
}

async function selectNext() {
	if (selectedIndex.value + 1 >= rows.value.length && hasMore.value) {
		await loadMore()
	}
	if (selectedIndex.value + 1 < rows.value.length) {
		selectedIndex.value += 1
	}
}

function closeDetail() {
	showDetail.value = false
	const name = selected.value?.name
	nextTick(() =>
		listScroller.value
			?.querySelector<HTMLElement>(`[data-response="${name}"]`)
			?.focus()
	)
}

function back() {
	if (showDetail.value) closeDetail()
	else show.value = false
}

async function exportCsv() {
	exporting.value = true
	try {
		const all = (await fetchPage(0, 0)) ?? []
		downloadCsv(props.config.filename, [
			[
				__('Student'),
				__('Submitted on'),
				...props.config.scores.map((score) => score.label),
				__('Comment'),
			],
			...all.map((row) => [
				row.member_name,
				dayjs(row.creation).format('YYYY-MM-DD HH:mm'),
				...props.config.scores.map((score) => starsOf(row, score.key) || ''),
				row.feedback,
			]),
		])
	} finally {
		exporting.value = false
	}
}

watch(show, async (open) => {
	if (!open) {
		// Reset while closed, so the next open fetches once and not again
		// when the filter watcher sees this change.
		filter.value = 'all'
		loads++
		loaded.value = false
		loadError.value = null
		rows.value = []
		showDetail.value = false
		return
	}
	await reload()
	if (props.initialResponse && loaded.value) {
		const index = rows.value.findIndex(
			(row) => row.name === props.initialResponse
		)
		select(Math.max(index, 0))
	}
})

watch(filter, (value, previous) => {
	if (show.value && previous) reload()
})
</script>
