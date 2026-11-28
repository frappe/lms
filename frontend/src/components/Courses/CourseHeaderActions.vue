<template>
	<Dropdown
		:options="menu"
		:button="{
			icon: 'lucide-ellipsis',
			variant: 'ghost',
			label: __('Course options'),
		}"
		side="bottom"
		align="end"
	/>
	<Button
		v-if="canPublish && !course.data?.published && !isMobile"
		variant="subtle"
		:loading="actions.publish.loading"
		@click="actions.togglePublish()"
	>
		{{ __('Publish') }}
	</Button>
	<HeaderButton
		:label="__('Student view')"
		icon="lucide-eye"
		@click="emit('studentView')"
	/>
</template>

<script setup lang="ts">
import { Button, Dropdown } from 'frappe-ui'
import { computed } from 'vue'
import HeaderButton from '@/components/HeaderButton.vue'
import type { CourseActions } from '@/composables/useCourseActions'
import { useScreenSize } from '@/utils/composables'
import type { CourseDetails, Resource } from '@/types'

/** Course menu, Publish and Student view, on the Overview and Settings tabs. */
const props = defineProps<{
	course: Resource<CourseDetails | null>
	actions: CourseActions
	canPublish: boolean
}>()

const emit = defineEmits<{ studentView: [] }>()

const { isMobile } = useScreenSize()

interface MenuItem {
	label: string
	icon: string
	theme?: string
	onClick: () => void
}

// Unpublish lives here and in Options › Manage; on a phone Publish does too.
const publishItem = computed<MenuItem | null>(() => {
	const published = Boolean(props.course.data?.published)
	if (!props.canPublish || (!published && !isMobile.value)) return null
	return {
		label: published ? __('Unpublish course') : __('Publish course'),
		icon: published ? 'lucide-globe-lock' : 'lucide-globe',
		onClick: () => props.actions.togglePublish(),
	}
})

const menu = computed<MenuItem[]>(() => [
	...(publishItem.value ? [publishItem.value] : []),
	{
		label: __('Export'),
		icon: 'lucide-download',
		onClick: () => props.actions.exportCourse(),
	},
	{
		label: __('Delete'),
		icon: 'lucide-trash-2',
		theme: 'red',
		onClick: () => props.actions.deleteCourse(),
	},
])
</script>
