<template>
	<EmptyStateLayout
		name="Page"
		:title="__('Page not found')"
		:description="
			__('The page you are looking for does not exist or has moved.')
		"
		icon="lucide-compass"
		width="lg"
	>
		<Button
			:label="__('Back to Home')"
			@click="router.push({ name: 'Home' })"
		/>
	</EmptyStateLayout>
</template>
<script setup>
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>
