<template>
	<section class="relative z-[1] mx-auto max-w-6xl px-4 pb-6 pt-12 md:pt-16">
		<div class="max-w-3xl">
			<p v-if="hero.eyebrow" class="lp-eyebrow">{{ hero.eyebrow }}</p>
			<h1 class="mt-4 text-[2.75rem] leading-[1.15] md:text-[4rem]">
				{{ hero.headline }}
			</h1>
			<p v-if="hero.lede" class="lp-muted mt-5 max-w-2xl text-lg">
				{{ hero.lede }}
			</p>
			<div class="mt-8 flex flex-wrap gap-4">
				<a href="/login" class="lp-btn-primary no-underline">{{
					__('Student Login')
				}}</a>
				<a href="#courses" class="lp-btn-secondary no-underline">{{
					__('Browse courses')
				}}</a>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { LandingContent } from '@/pages/Landing/content'

defineProps<{ hero: LandingContent['hero'] }>()
</script>
