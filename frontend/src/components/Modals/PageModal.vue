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
import { Dialog, FormControl, createResource } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { reactive } from 'vue'
import IconPicker from '@/components/Controls/IconPicker.vue'
import { showToast } from '@/utils'

const topics = defineModel('reloadSidebar')
const show = defineModel()
const page = reactive({
	icon: '',
	webpage: '',
})

const webPage = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Sidebar Item',
				web_page: page.webpage,
				icon: page.icon,
				parent: 'LMS Settings',
				parentfield: 'sidebar_items',
				parenttype: 'LMS Settings',
			},
		}
	},
})

const addWebPage = (close) => {
	webPage.submit(
		{},
		{
			onSuccess() {
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
