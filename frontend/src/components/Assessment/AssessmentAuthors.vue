<template>
	<div
		v-if="authors.length"
		role="group"
		:aria-label="groupLabel"
		data-testid="assessment-authors"
		class="flex min-w-0 items-center gap-2 text-base text-ink-gray-7"
	>
		<div
			class="flex shrink-0 -space-x-1.5 rtl:space-x-reverse"
			aria-hidden="true"
		>
			<Avatar
				v-for="author in authors"
				:key="author.name"
				:image="author.user_image || ''"
				:label="author.full_name"
				size="sm"
			/>
		</div>
		<span class="truncate">{{ names }}</span>
	</div>
</template>

<script setup lang="ts">
import { Avatar } from 'frappe-ui'
import { computed, inject } from 'vue'
import { useAssessmentAuthors } from '@/composables/useAssessmentAuthors'
import type { AssessmentAuthor, AssessmentDoctype, SessionUser } from '@/types'

const props = defineProps<{
	doctype: AssessmentDoctype
	name: string | null
}>()

const user = inject<SessionUser>('$user')!
const groupLabel = __('Authors')

// Context for whoever reviews the work; a learner is not shown it.
const isReviewer = computed<boolean>(() =>
	Boolean(
		user.data?.is_moderator ||
			user.data?.is_instructor ||
			user.data?.is_evaluator
	)
)

const info = useAssessmentAuthors(props.doctype, () =>
	isReviewer.value ? props.name : null
)

const authors = computed<AssessmentAuthor[]>(() => info.data?.authors || [])

const names = computed<string>(() =>
	authors.value.map((author) => author.full_name).join(', ')
)
</script>
