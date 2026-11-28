<template>
	<Dropdown
		v-if="menu.length"
		:options="menu"
		:button="{
			icon: 'lucide-ellipsis',
			variant: 'ghost',
			label: __('Batch options'),
		}"
		side="bottom"
		align="end"
	/>
	<HeaderButton
		:label="__('Student view')"
		icon="lucide-eye"
		@click="emit('student-view')"
	/>
	<template v-if="isEditTab && form">
		<Button
			v-if="!isMobile && manage && !batch.data?.published"
			variant="subtle"
			:loading="manage.publishing()"
			@click="manage.togglePublish()"
		>
			{{ __('Publish') }}
		</Button>
		<BatchSaveButton v-if="isMobile" :form="form" />
	</template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Dropdown } from 'frappe-ui'
import BatchSaveButton from '@/pages/Batches/components/BatchSaveButton.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useScreenSize } from '@/utils/composables'
import { injectBatchForm } from '@/pages/Batches/composables/useBatchForm'
import { injectBatchManage } from '@/pages/Batches/composables/useBatchManage'
import type { BatchDetails, Resource } from '@/types'

const props = defineProps<{
	tab?: string
	batch: Resource<BatchDetails | null>
}>()

const emit = defineEmits<{ 'student-view': [] }>()

const { isMobile } = useScreenSize()
const form = injectBatchForm()
const manage = injectBatchManage()

const isEditTab = computed(() =>
	['overview', 'settings'].includes(props.tab ?? 'overview')
)

const menu = computed(() => {
	if (!manage) return []
	const options = []
	if (props.batch.data?.certification && props.batch.data?.student_count) {
		options.push({
			label: __('Generate certificates'),
			icon: 'lucide-award',
			onClick: manage.generateCertificates,
		})
	}
	// Unpublish lives here; on a phone Publish does too.
	if (props.batch.data?.published || isMobile.value) {
		options.push({
			label: props.batch.data?.published
				? __('Unpublish batch')
				: __('Publish batch'),
			icon: props.batch.data?.published ? 'lucide-globe-lock' : 'lucide-globe',
			onClick: manage.togglePublish,
		})
	}
	options.push({
		label: __('Delete batch'),
		icon: 'lucide-trash-2',
		theme: 'red',
		onClick: manage.deleteBatch,
	})
	return options
})
</script>
