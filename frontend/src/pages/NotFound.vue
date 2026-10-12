<template>
	<EmptyStateLayout
		name="Page"
		:title="__('Page not found')"
		:description="
			__('The page you are looking for does not exist or has moved')
		"
		icon="lucide-compass"
		width="lg"
	>
		<Button
			class="text-p-base-medium"
			:label="__('Back to Home')"
			@click="router.push({ name: 'Home' })"
		/>
	</EmptyStateLayout>
</template>
<script setup>
import { Button, usePageMeta } from 'frappe-ui'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'

const router = useRouter()
const { brand } = sessionStore()

usePageMeta(() => ({ title: __('Page not found'), icon: brand.favicon }))
</script>
