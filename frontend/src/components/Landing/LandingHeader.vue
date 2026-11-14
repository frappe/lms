<template>
	<header class="lp-nav">
		<div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
			<a
				href="#top"
				class="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold text-[var(--lp-title)] no-underline md:flex-none"
			>
				<img
					v-if="brand.logo"
					:src="brand.logo"
					alt=""
					class="h-8 w-auto max-w-[140px] object-contain"
				/>
				<span class="truncate">{{ brand.name }}</span>
			</a>

			<nav
				:aria-label="__('Sections')"
				class="hidden min-w-0 flex-1 items-center gap-5 xl:flex"
			>
				<a
					v-for="link in links"
					:key="link.href"
					:href="link.href"
					class="lp-nav-link"
					>{{ link.label }}</a
				>
			</nav>

			<div class="hidden md:block">
				<a
					href="/login"
					class="lp-btn-primary whitespace-nowrap no-underline"
					>{{ __('Student Login') }}</a
				>
			</div>

			<div class="xl:hidden">
				<button
					type="button"
					class="lp-menu-button"
					:aria-expanded="String(menuOpen)"
					aria-controls="lp-mobile-menu"
					@click="menuOpen = !menuOpen"
				>
					<span class="sr-only">{{
						menuOpen ? __('Close menu') : __('Open menu')
					}}</span>
					<span aria-hidden="true">{{ menuOpen ? '✕' : '☰' }}</span>
				</button>
			</div>
		</div>

		<div v-if="menuOpen" id="lp-mobile-menu" class="lp-mobile-menu xl:hidden">
			<a
				v-for="link in links"
				:key="link.href"
				:href="link.href"
				class="lp-mobile-link"
				@click="menuOpen = false"
			>
				{{ link.label }}
			</a>
			<a href="/login" class="lp-btn-primary mt-3 no-underline">{{
				__('Student Login')
			}}</a>
		</div>
	</header>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ brand: { name: string; logo: string | null } }>()

const menuOpen = ref(false)

const links = [
	{ href: '#courses', label: __('Classroom Courses') },
	{ href: '#courses', label: __('Online Courses') },
	{ href: '#test-series', label: __('Test Series') },
	{ href: '#contact', label: __('Results') },
	{ href: '#contact', label: __('Study Materials') },
	{ href: '#scholarships', label: __('Scholarships') },
]
</script>
