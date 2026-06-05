<template>
	<SettingsLayout :title="__(label)" :description="__(description)">
		<template #title-badge>
			<Badge
				v-if="data.isDirty"
				:label="__('Not Saved')"
				variant="subtle"
				theme="orange"
			/>
		</template>
		<template #header-actions>
			<Button variant="solid" :loading="data.save.loading" @click="update">
				{{ __('Update') }}
			</Button>
		</template>
		<SettingFields :sections="sections" :data="data.doc" />
	</SettingsLayout>
</template>

<script setup>
import { Button, Badge, toast } from 'frappe-ui'
import SettingFields from '@/components/Settings/SettingFields.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const props = defineProps({
	sections: {
		type: Array,
		required: true,
	},
	data: {
		type: Object,
		required: true,
	},
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
	},
})

const update = () => {
	props.data.save.submit(
		{},
		{
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}
</script>

<style>
.CodeMirror pre.CodeMirror-line,
.CodeMirror pre.CodeMirror-line-like {
	font-family: revert;
}

.CodeMirror {
	border-radius: 12px;
}
</style>
