<template>
	<div class="flex items-center gap-x-4 mt-2">
		<a
			v-if="twitter"
			:href="safeUrl(twitter)"
			v-external
			:aria-label="__('Twitter')"
		>
			<Twitter class="size-4 text-ink-gray-5 cursor-pointer" />
		</a>
		<a
			v-if="linkedin"
			:href="safeUrl(linkedin)"
			v-external
			:aria-label="__('LinkedIn')"
		>
			<Linkedin class="size-4 text-ink-gray-5 cursor-pointer" />
		</a>
		<a
			v-if="github"
			:href="safeUrl(github)"
			v-external
			:aria-label="__('GitHub')"
		>
			<Github class="size-4 text-ink-gray-5 cursor-pointer" />
		</a>
	</div>
</template>
<script setup lang="ts">
import { Github, Linkedin, Twitter } from 'lucide-vue-next'
import { safeUrl } from '@/utils/safeUrl'

defineProps<{
	twitter?: string | null
	linkedin?: string | null
	github?: string | null
}>()
</script>
