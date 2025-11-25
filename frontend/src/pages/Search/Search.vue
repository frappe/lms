<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="[{ label: __('Search') }]" />
	</header>
	<div></div>
</template>
<script setup lang="ts">
import { Breadcrumbs, TextInput } from 'frappe-ui'
</script>
