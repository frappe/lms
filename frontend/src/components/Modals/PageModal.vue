<template>
	<Dialog
		v-model="show"
		class="text-base"
		:options="{
			title: __('Add web page to sidebar'),
			size: 'lg',
			actions: [
				{
					label: 'Add',
					variant: 'solid',
					onClick: (close) => {
						addWebPage(close)
					},
				},
			],
		}"
	>
		<template #body-content>
			<Link
				v-model="page.webpage"
				doctype="Web Page"
				:label="__('Web Page')"
				:filters="{
					published: 1,
				}"
			/>
			<IconPicker v-model="page.icon" :label="__('Icon')" class="mt-4" />
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, createResource } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { reactive, watch } from 'vue'
import IconPicker from '@/components/Controls/IconPicker.vue'
import { showToast } from '@/utils'

const sidebar = defineModel('reloadSidebar')
const show = defineModel()
const page = reactive({
	icon: '',
	webpage: '',
})

const props = defineProps({
	page: {
		type: Object,
		default: null,
	},
})

const webPage = createResource({
	url: 'lms.lms.api.update_sidebar_item',
	makeParams(values) {
		return {
			webpage: page.webpage,
			icon: page.icon,
		}
	},
})

watch(
	() => props.page,
	(newPage) => {
		if (newPage) {
			page.icon = newPage.icon
			page.webpage = newPage.web_page
		}
	},
	{ immediate: true }
)

const addWebPage = (close) => {
	webPage.submit(
		{},
		{
			onSuccess() {
				sidebar.value.reload()
				close()
				showToast('Success', 'Web page added to sidebar', 'check')
			},
			onError(err) {
				showToast('Error', err.message[0] || err, 'x')
				close()
			},
		}
	)
}
</script>
