<template>
	<div class="space-y-5" data-testid="copilot-course-draft">
		<div>
			<h2 class="text-lg-semibold text-ink-gray-9">{{ preview.title }}</h2>
			<p v-if="preview.introduction" class="mt-1 text-p-base text-ink-gray-6">
				{{ preview.introduction }}
			</p>
			<p v-if="preview.files?.length" class="mt-1 text-p-sm text-ink-gray-5">
				{{ __('From: {0}').format(preview.files.join(', ')) }}
			</p>
		</div>

		<section v-for="chapter in preview.chapters || []" :key="chapter.number">
			<h3 class="mb-2 text-base-semibold text-ink-gray-9">
				{{ __('Chapter {0}: {1}').format(chapter.number, chapter.title) }}
			</h3>
			<ol class="space-y-1.5">
				<li
					v-for="lesson in chapter.lessons"
					:key="lesson.key || lesson.number"
					class="rounded border"
					:class="
						lesson.missing_material
							? 'border-outline-red-3'
							: 'border-outline-gray-2'
					"
				>
					<details>
						<summary
							class="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2"
						>
							<span class="text-p-base font-medium text-ink-gray-9">
								{{ lesson.number }} {{ lesson.title }}
							</span>
							<Badge
								v-if="lesson.missing_material"
								theme="red"
								variant="subtle"
								:label="__('Missing material')"
							/>
							<template v-else>
								<Badge
									v-for="source in lesson.sources"
									:key="source"
									theme="gray"
									variant="subtle"
									:label="source"
								/>
							</template>
						</summary>
						<pre
							class="max-h-96 overflow-auto whitespace-pre-wrap border-t border-outline-gray-2 bg-surface-gray-1 px-3 py-2 font-mono text-p-sm text-ink-gray-8"
							>{{ lesson.markdown }}</pre
						>
					</details>
				</li>
			</ol>
		</section>

		<template v-if="preview.assignments?.length">
			<h3 class="text-base-semibold text-ink-gray-9">
				{{ __('Assignments and rubrics') }}
			</h3>
			<div
				v-for="(item, index) in preview.assignments"
				:key="index"
				class="space-y-2 rounded-6 border border-outline-gray-2 p-3"
			>
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-p-base font-medium text-ink-gray-9">
						{{ item.title }}
					</span>
					<Badge
						v-if="item.after_lesson"
						theme="violet"
						variant="subtle"
						:label="__('After lesson {0}').format(item.after_lesson)"
					/>
					<Badge
						v-for="source in item.sources"
						:key="source"
						theme="gray"
						variant="subtle"
						:label="source"
					/>
				</div>
				<pre
					class="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-surface-gray-1 px-3 py-2 font-mono text-p-sm text-ink-gray-8"
					>{{ item.question }}</pre
				>
				<ul class="list-disc space-y-1 ps-5 text-p-base text-ink-gray-7">
					<li v-for="row in item.criteria" :key="row.criterion">
						<b class="text-ink-gray-9">{{ row.criterion }}</b>
						{{ ' (1–' + row.max_level + ')' }}
						<template v-if="row.description">— {{ row.description }}</template>
						<template v-if="row.taught_in_lesson">
							· {{ __('taught in {0}').format(row.taught_in_lesson) }}
						</template>
					</li>
				</ul>
			</div>
		</template>
	</div>
</template>

<script setup>
import { Badge } from 'frappe-ui'

defineProps({
	preview: { type: Object, required: true },
})
</script>
