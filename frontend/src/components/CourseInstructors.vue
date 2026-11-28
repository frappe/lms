<template>
	<!-- z-[1] lifts the links over a card's full-card link and keeps them
	     under the sticky page header (z-10) when a lesson scrolls. -->
	<div class="text-ink-gray-7">
		<template
			v-for="(instructor, index) in named"
			:key="instructor.username || index"
		>
			<template v-if="index">
				{{ index === named.length - 1 && !others ? ` ${__('and')} ` : ', ' }}
			</template>
			<InstructorHoverCard v-if="showHoverCards" :instructor="instructor">
				<component
					:is="instructor.username ? 'router-link' : 'span'"
					v-bind="linkProps(instructor)"
					class="underline decoration-dotted underline-offset-4"
				>
					{{ displayName(instructor) }}
				</component>
			</InstructorHoverCard>
			<component
				v-else
				:is="instructor.username ? 'router-link' : 'span'"
				v-bind="linkProps(instructor)"
			>
				{{ displayName(instructor) }}
			</component>
		</template>
		<template v-if="others">
			{{ ` ${__('and {0} others').format(others)}` }}
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import InstructorHoverCard from '@/components/InstructorHoverCard.vue'
import type { CourseInstructorInfo, SessionUser } from '@/types'

/** Up to three instructors by name; more collapse to "and N others". */
const props = defineProps<{
	instructors: CourseInstructorInfo[]
	/** Show each named instructor's card on hover to signed-in users. */
	hoverCards?: boolean
}>()

const user = inject<SessionUser | undefined>('$user', undefined)

const showHoverCards = computed(() => props.hoverCards && !!user?.data?.name)

const MAX_NAMED = 3

const named = computed(() =>
	props.instructors.length > MAX_NAMED
		? props.instructors.slice(0, 1)
		: props.instructors
)

const others = computed(() =>
	props.instructors.length > MAX_NAMED ? props.instructors.length - 1 : 0
)

const displayName = (instructor: CourseInstructorInfo): string =>
	props.instructors.length === 1
		? instructor.full_name || ''
		: instructor.first_name || instructor.full_name || ''

const linkProps = (instructor: CourseInstructorInfo) =>
	instructor.username
		? {
				to: { name: 'Profile', params: { username: instructor.username } },
				class: 'relative z-[1] text-ink-gray-7 hover:text-ink-gray-9',
		  }
		: {}
</script>
