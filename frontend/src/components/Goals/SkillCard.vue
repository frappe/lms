<template>
	<!-- The Skills list card. Home shows popular skills with it too, so a skill looks the same everywhere. -->
	<article
		class="relative flex flex-col gap-2.5 rounded-7 border border-outline-gray-2 bg-surface-base p-4 transition-colors hover:border-outline-gray-4"
	>
		<div v-if="topLine" class="text-p-xs text-ink-gray-6">{{ topLine }}</div>
		<Badge
			v-else-if="badge"
			class="self-start"
			:theme="badge.theme"
			:label="badge.label"
		/>

		<h2 class="text-base-semibold text-ink-gray-9">
			<router-link
				v-if="to"
				:to="to"
				class="after:absolute after:inset-0 after:rounded-7 focus-visible:outline-none"
			>
				{{ title }}
			</router-link>
			<button
				v-else
				type="button"
				class="text-start after:absolute after:inset-0 after:rounded-7 focus-visible:outline-none"
				@click="emit('open')"
			>
				{{ title }}
			</button>
		</h2>
		<p v-if="description" class="line-clamp-2 text-p-sm text-ink-gray-6">
			{{ description }}
		</p>

		<Progress
			v-if="progress"
			class="mt-auto pt-1.5"
			:value="progress"
			size="sm"
			:aria-label="__('Progress')"
		/>
		<div
			class="flex min-h-7 items-center gap-2.5"
			:class="progress ? 'pt-0.5' : 'mt-auto pt-1.5'"
		>
			<div v-if="instructor" class="flex min-w-0 items-center gap-2">
				<Avatar
					:image="instructor.image"
					:label="instructor.full_name"
					size="md"
				/>
				<span class="truncate text-p-sm text-ink-gray-7">
					{{ instructor.full_name }}
				</span>
			</div>
			<span v-if="instructor" class="flex-1" />
			<span v-if="meta" class="text-p-sm text-ink-gray-6">{{ meta }}</span>
		</div>
	</article>
</template>
<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { Avatar, Badge, Progress } from 'frappe-ui'

withDefaults(
	defineProps<{
		title: string
		description?: string
		/** A small line above the title, such as the due date. Wins over `badge`. */
		topLine?: string
		badge?: { label: string; theme: string } | null
		instructor?: { full_name: string; image?: string } | null
		/** Bottom right, or bottom left without an instructor. */
		meta?: string
		/** The learner's own progress, 0 to 100, as a bar above the footer. */
		progress?: number
		/** Without it the card is a button that emits `open`. */
		to?: RouteLocationRaw
	}>(),
	{
		description: '',
		topLine: '',
		badge: null,
		instructor: null,
		meta: '',
		progress: 0,
	}
)

const emit = defineEmits<{ open: [] }>()
</script>
