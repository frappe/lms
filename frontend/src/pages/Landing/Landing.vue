<template>
	<div id="top" class="lp-root" :style="brandStyle">
		<div class="lp-glow" aria-hidden="true"></div>

		<div
			v-if="content.promo"
			class="relative z-[6] bg-[var(--lp-accent)] px-4 py-2 text-center text-sm font-medium text-[var(--lp-on-accent)]"
		>
			{{ content.promo }}
		</div>

		<LandingHeader :brand="brand" />
		<div
			class="relative z-[1] mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-3"
		>
			<div class="min-w-0 lg:col-span-2">
				<LandingCarousel
					v-if="content.slides.length"
					:slides="content.slides"
				/>
			</div>
			<aside id="why" class="lp-card min-w-0 scroll-mt-24 p-6 md:p-8">
				<h2 class="lp-section-title">{{ __('Why Us') }}</h2>
				<ul class="mt-6 grid gap-4">
					<li
						v-for="point in whyUs"
						:key="point"
						class="flex gap-3 text-[var(--lp-body)]"
					>
						<span class="mt-0.5 text-[var(--lp-accent)]" aria-hidden="true"
							>✓</span
						>
						<span>{{ __(point) }}</span>
					</li>
				</ul>
			</aside>
		</div>
		<LandingHero :hero="content.hero" />

		<LandingCourses />

		<section
			id="test-series"
			class="relative z-[1] mx-auto max-w-6xl scroll-mt-24 px-4 py-10"
		>
			<div
				class="lp-card flex flex-col gap-6 border-[var(--lp-accent)] p-6 md:flex-row md:items-center md:justify-between md:p-12"
			>
				<div class="min-w-0">
					<p class="lp-eyebrow">{{ __(testSeries.label) }}</p>
					<h2 class="lp-section-title mt-3">{{ __(testSeries.headline) }}</h2>
					<p class="lp-muted mt-3 max-w-xl">{{ __(testSeries.text) }}</p>
				</div>
				<a
					href="/login"
					class="lp-btn-primary whitespace-nowrap no-underline"
					>{{ __('Student Login') }}</a
				>
			</div>
		</section>

		<section
			id="scholarships"
			class="relative z-[1] mx-auto max-w-6xl scroll-mt-24 px-4 py-10"
		>
			<div
				class="lp-card flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-12"
			>
				<div class="min-w-0">
					<p class="lp-eyebrow">{{ __('Scholarships') }}</p>
					<h2 class="lp-section-title mt-3">{{ __(scholarship.title) }}</h2>
					<p class="lp-muted mt-3 max-w-xl">{{ __(scholarship.text) }}</p>
				</div>
				<a
					href="#contact"
					class="lp-btn-primary whitespace-nowrap no-underline"
					>{{ __('Enquire now') }}</a
				>
			</div>
		</section>

		<LandingBranches :branches="content.branches" />
		<LandingContact :contact="content.contact" />

		<footer
			class="relative z-[1] border-t border-[var(--lp-border)] px-4 py-8 text-sm text-[var(--lp-caption)]"
		>
			<div class="mx-auto flex max-w-6xl flex-wrap justify-between gap-2">
				<span>© {{ brand.name }}</span>
			</div>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { createResource } from 'frappe-ui'
import LandingHeader from '@/components/Landing/LandingHeader.vue'
import LandingHero from '@/components/Landing/LandingHero.vue'
import LandingCarousel from '@/components/Landing/LandingCarousel.vue'
import LandingCourses from '@/components/Landing/LandingCourses.vue'
import LandingBranches from '@/components/Landing/LandingBranches.vue'
import LandingContact from '@/components/Landing/LandingContact.vue'
import { sessionStore } from '@/stores/session'
import { scholarship, testSeries, whyUs } from '@/pages/Landing/content'
import type { LandingContent } from '@/pages/Landing/content'
import './landing.css'

const EMPTY: LandingContent = {
	enabled: false,
	brand: { name: '', logo: null, primary_colour: '' },
	promo: '',
	hero: { eyebrow: '', headline: '', lede: '' },
	slides: [],
	branches: [],
	contact: { phone: '', email: '', website: '' },
}

const landing = createResource({
	url: 'lms.lms.api.get_landing_content',
	auto: true,
})

const content = computed<LandingContent>(() => {
	const data = (landing.data as Partial<LandingContent> | undefined) || {}
	return {
		...EMPTY,
		...data,
		hero: { ...EMPTY.hero, ...(data.hero || {}) },
		contact: { ...EMPTY.contact, ...(data.contact || {}) },
		brand: { ...EMPTY.brand, ...(data.brand || {}) },
		slides: data.slides || [],
		branches: data.branches || [],
	}
})

const brand = computed(() => ({
	// A blank name in settings falls back to the site name.
	name: content.value.brand.name || sessionStore().brand.name || '',
	logo: content.value.brand.logo || sessionStore().brand.logo || null,
}))

// The brand colour from settings sets the accent. The stylesheet's default applies when blank.
const brandStyle = computed(() => {
	const colour = content.value.brand.primary_colour
	if (!/^#[0-9a-fA-F]{6}$/.test(colour)) return {}
	return {
		'--lp-accent': colour,
		'--lp-on-accent': readableOn(colour),
	}
})

// Dark text on a light accent, white on a dark one, so the button text stays readable.
function readableOn(hex: string) {
	const [r, g, b] = [1, 3, 5].map(
		(i) => parseInt(hex.slice(i, i + 2), 16) / 255,
	)
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
	return luminance > 0.55 ? '#000510' : '#ffffff'
}
</script>
