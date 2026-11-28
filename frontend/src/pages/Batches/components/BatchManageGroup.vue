<template>
	<SettingsGroup
		v-if="manage"
		:title="__('Manage')"
		icon="lucide-sliders-horizontal"
	>
		<SettingAction
			:label="published ? __('Unpublish batch') : __('Publish batch')"
			:summary="
				published
					? __(
							'Hide it from the batches list. Enrolled learners keep their access.'
					  )
					: __('List it on the batches page so learners can find it.')
			"
			:action="published ? __('Unpublish') : __('Publish')"
			:loading="manage.publishing()"
			@click="manage.togglePublish()"
		/>
		<SettingAction
			v-if="batch.data?.certification"
			:label="__('Generate certificates')"
			:summary="__('Issue certificates to learners who completed the batch.')"
			:action="__('Generate')"
			@click="manage.generateCertificates()"
		/>
		<SettingAction
			:label="__('Delete batch')"
			:summary="
				__(
					'Removes the batch with its students, courses, assessments, feedback and discussions.'
				)
			"
			:action="__('Delete')"
			danger
			@click="manage.deleteBatch()"
		/>
	</SettingsGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SettingAction from '@/components/InlineEdit/SettingAction.vue'
import SettingsGroup from '@/components/InlineEdit/SettingsGroup.vue'
import { injectBatchManage } from '@/pages/Batches/composables/useBatchManage'
import type { BatchDetails, Resource } from '@/types'

/** The final settings box: publish, certificates and delete. */
const props = defineProps<{ batch: Resource<BatchDetails | null> }>()

const manage = injectBatchManage()
const published = computed(() => Boolean(props.batch.data?.published))
</script>
