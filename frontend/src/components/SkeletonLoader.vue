<template>
	<div class="motion-safe:animate-pulse" aria-hidden="true">
		<div v-if="variant === 'course-page'" class="p-5">
			<div
				class="flex w-full flex-col items-start justify-between gap-x-8 gap-y-8 md:flex-row"
			>
				<div class="w-full min-w-0 space-y-10 md:w-2/3">
					<section class="space-y-4">
						<div class="h-7 w-2/3 rounded bg-surface-gray-3" />
						<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
							<div class="h-5 w-24 rounded bg-surface-gray-2" />
							<div class="h-5 w-20 rounded bg-surface-gray-2" />
							<div class="h-5 w-28 rounded bg-surface-gray-2" />
						</div>
						<div class="flex flex-wrap gap-2">
							<div class="h-6 w-16 rounded bg-surface-gray-2" />
							<div class="h-6 w-20 rounded bg-surface-gray-2" />
						</div>
						<div class="space-y-2">
							<div class="h-6 w-full rounded bg-surface-gray-2" />
							<div class="h-6 w-5/6 rounded bg-surface-gray-2" />
						</div>
						<div
							class="h-80 w-full max-w-sm rounded-md bg-surface-gray-3 md:hidden"
						/>
					</section>

					<section>
						<div class="mb-4 flex items-baseline justify-between gap-4">
							<div class="h-6 w-48 rounded bg-surface-gray-3" />
							<div class="h-4 w-24 rounded bg-surface-gray-2" />
						</div>
						<div class="rounded-md border p-2">
							<div v-for="i in 6" :key="i" class="flex h-9 items-center px-2">
								<div class="h-5 w-2/3 rounded bg-surface-gray-2" />
							</div>
						</div>
					</section>

					<section class="space-y-3">
						<div class="h-6 w-56 rounded bg-surface-gray-3" />
						<div
							v-for="i in 3"
							:key="i"
							class="h-4 rounded bg-surface-gray-2"
							:class="i === 3 ? 'w-2/3' : 'w-full'"
						/>
					</section>
				</div>

				<aside class="hidden w-80 shrink-0 flex-col space-y-6 md:flex">
					<div class="h-80 w-full rounded-md bg-surface-gray-3" />
					<div class="h-40 w-full rounded-md bg-surface-gray-2" />
				</aside>
			</div>
		</div>

		<div
			v-else-if="variant === 'form'"
			class="grid h-full grid-cols-1 md:grid-cols-[70%,30%]"
		>
			<div class="space-y-8 p-5">
				<section v-for="s in 2" :key="s" class="space-y-5">
					<div class="h-4 w-40 rounded bg-surface-gray-3" />
					<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
						<div v-for="i in 4" :key="i" class="space-y-1.5">
							<div class="h-4 w-24 rounded bg-surface-gray-2" />
							<div class="h-7 w-full rounded bg-surface-gray-2" />
						</div>
					</div>
				</section>
			</div>
			<div class="space-y-4 border-t p-5 md:border-s md:border-t-0 md:px-3">
				<div v-for="i in 5" :key="i" class="flex items-start gap-3">
					<div class="h-5 w-9 shrink-0 rounded-full bg-surface-gray-2" />
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="h-4 w-1/3 rounded bg-surface-gray-2" />
						<div class="h-3 w-2/3 rounded bg-surface-gray-2" />
					</div>
				</div>
			</div>
		</div>

		<div v-else-if="variant === 'header'" class="header-frame justify-between">
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<div class="size-4 shrink-0 rounded bg-surface-gray-2 sm:hidden" />
				<div class="h-4 w-40 max-w-full rounded bg-surface-gray-3 sm:hidden" />
				<div class="hidden h-7 items-center gap-2 sm:flex">
					<div class="h-4 w-16 rounded bg-surface-gray-2" />
					<div class="h-4 w-1 rounded bg-surface-gray-2" />
					<div class="h-4 w-40 rounded bg-surface-gray-3" />
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<div class="size-9 rounded bg-surface-gray-2 sm:hidden" />
				<div class="size-9 rounded bg-surface-gray-2 sm:hidden" />
				<div class="hidden h-7 w-20 rounded bg-surface-gray-2 sm:block" />
				<div class="hidden h-7 w-24 rounded bg-surface-gray-3 sm:block" />
			</div>
		</div>

		<div v-else-if="variant === 'editor-content'" class="py-6 sm:py-10">
			<div class="space-y-6 px-4 sm:mx-10 sm:px-20">
				<div
					class="h-9 w-40 rounded-full bg-surface-gray-2 sm:h-7 sm:w-56 sm:rounded"
				/>
				<div class="h-7 w-2/3 rounded bg-surface-gray-3" />
				<div class="space-y-3">
					<div
						v-for="i in 5"
						:key="i"
						class="h-4 rounded bg-surface-gray-2"
						:class="i === 5 ? 'w-2/3' : 'w-full'"
					/>
				</div>
			</div>
		</div>

		<div
			v-else-if="variant === 'editor-sidebar' || variant === 'course-outline'"
			class="p-3"
		>
			<div
				v-for="i in outlineRows"
				:key="i"
				class="flex h-9 items-center gap-2 px-2"
			>
				<div class="size-4 shrink-0 rounded bg-surface-gray-2" />
				<div class="h-5 w-2/3 rounded bg-surface-gray-2" />
			</div>
		</div>

		<div v-else-if="variant === 'list'">
			<div class="mb-2 hidden h-8 rounded bg-surface-gray-2 sm:block" />
			<div
				v-for="i in count"
				:key="i"
				class="border-b border-outline-gray-1 py-3 last:border-b-0 sm:flex sm:h-10 sm:items-center sm:gap-4 sm:border-b-0 sm:px-2 sm:py-0"
			>
				<div class="h-5 w-2/3 rounded bg-surface-gray-2 sm:h-4 sm:w-1/3" />
				<div
					class="mt-1.5 h-4 w-1/3 rounded bg-surface-gray-2 sm:mt-0 sm:w-1/4"
				/>
				<div class="hidden h-4 w-1/5 rounded bg-surface-gray-2 sm:block" />
			</div>
		</div>

		<div
			v-else-if="variant === 'cards'"
			class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
		>
			<div
				v-for="i in count"
				:key="i"
				class="flex h-full flex-col rounded-md border p-4"
			>
				<div class="h-5 w-3/4 rounded bg-surface-gray-3" />
				<div class="mt-2 h-4 w-1/3 rounded bg-surface-gray-2" />
				<div class="mt-4 space-y-2">
					<div class="h-4 w-full rounded bg-surface-gray-2" />
					<div class="h-4 w-5/6 rounded bg-surface-gray-2" />
				</div>
				<div class="mt-6 flex items-center gap-2">
					<div class="size-6 shrink-0 rounded-full bg-surface-gray-2" />
					<div class="h-4 w-24 rounded bg-surface-gray-2" />
				</div>
			</div>
		</div>

		<div v-else class="space-y-2">
			<div
				v-for="i in lines"
				:key="i"
				class="h-4 rounded bg-surface-gray-2"
				:class="i === lines ? 'w-2/3' : 'w-full'"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Placeholder blocks shaped like the content they stand in for.
 *
 *   course-page     pages/Courses/CourseOverview.vue, Batches/BatchOverview.vue
 *   form            pages/Courses/CourseForm.vue (grid only — no page header)
 *   header          components/Layouts/PageHeader.vue, via .header-frame
 *   editor-content  pages/LessonForm.vue
 *   editor-sidebar  components/CourseOutline.vue in CourseEditor's full-height
 *                   aside, which it fills — hence a fixed 8 rows
 *   course-outline  the same CourseOutline inline in a page section, sized by
 *                   the call site's `count`
 *   list            components/ResponsiveListView.vue
 *   cards           the #card slot of a grid ListPage
 *
 * Each variant mirrors its counterpart's own breakpoint, not a house default:
 * anything keyed off `isMobile` (<640px) belongs at `sm:`, while CourseOverview
 * and CourseForm split at `md:`. A skeleton on the wrong rung renders
 * phone-shaped in the 640–767px band while its counterpart is already desktop.
 *
 * `header` wears .header-frame rather than restating it. Hand-copying the frame
 * is how the skeleton came to stand 56px tall after the real phone header moved
 * to 48, and every detail page jumped 8px when its data landed.
 *
 * `count` is rows, not chapters: CourseOutline mounts its first chapter
 * expanded whenever nothing else is active, and those lesson rows are 36px too.
 *
 * Call-site convention: guard on the absence of data (`!course.data`,
 * `loading && !rows.length`), never on a bare `loading`. A background refetch
 * keeps `.data` but re-raises `loading`, so a bare guard remounts the skeleton
 * over content the user is reading — and, with focus inside it, destroys that
 * focus (WCAG 2.4.3).
 *
 * The subtree is `aria-hidden`, matching frappe-ui's Skeleton primitive.
 * Announcing the fetch (WCAG 4.1.3) belongs to the page, not here: one page
 * mounts several of these, and that would be several announcements for one
 * fetch. `useLoadingAnnouncement` in utils/a11y.ts is the hook; ListPage wires
 * it for all twelve list pages, but CourseOverview, CourseDetail, BatchDetail,
 * CourseForm and CourseEditor still swap in a skeleton with nothing said.
 */
const props = withDefaults(
	defineProps<{
		variant?:
			| 'course-page'
			| 'form'
			| 'header'
			| 'editor-content'
			| 'editor-sidebar'
			| 'course-outline'
			| 'list'
			| 'cards'
			| 'lines'
		count?: number
		lines?: number
	}>(),
	{
		variant: 'lines',
		count: 5,
		lines: 3,
	}
)

const outlineRows = computed(() =>
	props.variant === 'editor-sidebar' ? 8 : props.count
)
</script>
