<template>
	<SkeletonLoader v-if="!form.resource.doc" variant="form" class="flex-1" />
	<SettingsPage v-else :openSection="openSection">
		<SettingsGroup
			:title="__('Thumbnail')"
			icon="lucide-image"
			name="thumbnail"
		>
			<CourseThumbnailPicker
				:image="form.resource.doc.image"
				:tint="form.resource.doc.card_gradient"
				:icon="form.resource.doc.icon"
				@update:image="(value) => setField('image', value)"
				@update:tint="(value) => setField('card_gradient', value)"
				@update:icon="(value) => setField('icon', value)"
			/>
		</SettingsGroup>

		<CoursePublishSettings />

		<SettingsGroup :title="__('Search and sharing')" icon="lucide-search">
			<SettingField
				v-model="form.meta.description"
				type="textarea"
				:label="__('Meta description')"
				:summary="
					__('About 150 characters. Leave empty to use the short introduction.')
				"
				@update:modelValue="form.markDirty()"
			/>
			<SettingField
				type="textarea"
				v-model="form.meta.keywords"
				:label="__('Meta keywords')"
				:summary="__('Comma separated keywords for search engines.')"
				@update:modelValue="form.markDirty()"
			/>
			<SettingRow
				:label="__('Meta preview')"
				:summary="
					__('Edit the meta description and course thumbnail to change this.')
				"
			>
				<SearchPreview
					:url="courseUrl"
					:title="form.resource.doc.title"
					:description="
						form.meta.description || form.resource.doc.short_introduction
					"
					:image="form.resource.doc.image"
				/>
			</SettingRow>
		</SettingsGroup>

		<SettingsGroup
			v-if="actions"
			:title="__('Manage')"
			icon="lucide-sliders-horizontal"
		>
			<SettingAction
				v-if="course.data?.published && user.data?.is_moderator"
				:label="__('Unpublish course')"
				:summary="
					__(
						'Hide it from the catalogue. Enrolled learners keep their access and progress.'
					)
				"
				:action="__('Unpublish')"
				:loading="actions.publish.loading"
				@click="actions.togglePublish()"
			/>
			<SettingAction
				:label="__('Export course')"
				:summary="
					__('Download a zip you can import on another Frappe Learning site.')
				"
				:action="__('Export')"
				@click="actions.exportCourse()"
			/>
			<SettingAction
				:label="__('Delete course')"
				:summary="
					__(
						'Removes the course, its lessons and learner progress. This cannot be undone.'
					)
				"
				:action="__('Delete')"
				danger
				@click="actions.deleteCourse()"
			/>
		</SettingsGroup>
	</SettingsPage>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseThumbnailPicker from '@/components/InlineEdit/CourseThumbnailPicker.vue'
import SettingAction from '@/components/InlineEdit/SettingAction.vue'
import SettingField from '@/components/InlineEdit/SettingField.vue'
import SettingsPage from '@/components/InlineEdit/SettingsPage.vue'
import SearchPreview from '@/components/InlineEdit/SearchPreview.vue'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'
import SettingsGroup from '@/components/InlineEdit/SettingsGroup.vue'
import CoursePublishSettings from '@/pages/Courses/CoursePublishSettings.vue'
import { COURSE_ACTIONS } from '@/composables/useCourseActions'
import { useCourseFlowChanges } from '@/composables/useFlowChanges'
import type {
	CourseDetails,
	CourseFormContext,
	Resource,
	SessionUser,
} from '@/types'
import type { LMSCourse } from '@/types/lms/LMSCourse'

/** The Settings tab: settings that have no place on the course page itself. */
const props = defineProps<{ course: Resource<CourseDetails | null> }>()

const form = inject<CourseFormContext>('courseForm')!
useCourseFlowChanges(props.course)
const route = useRoute()
// ?section=thumbnail, from the overview card's Edit thumbnail, opens there.
const openSection = computed(() => route.query.section as string | undefined)
const actions = inject(COURSE_ACTIONS, null)
const user = inject<SessionUser>('$user')!

// The address learners share, without the scheme, as search results print it.
const courseUrl = computed<string>(
	() => `${window.location.host}/lms/courses/${form.resource.doc?.name ?? ''}`
)

function setField(field: keyof LMSCourse, value: unknown): void {
	;(form.resource.doc as Record<string, unknown>)[field] = value
	form.markDirty()
}
</script>
