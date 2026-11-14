<template>
	<section
		class="relative z-[1]"
		:aria-roledescription="__('carousel')"
		:aria-label="__('Highlights')"
		@mouseenter="paused = true"
		@mouseleave="paused = false"
		@focusin="paused = true"
		@focusout="paused = false"
	>
		<div class="lp-carousel">
			<article
				v-for="(slide, i) in slides"
				:key="`${i}-${slide.title}`"
				class="lp-slide"
				:class="{ 'is-active': i === index }"
				:aria-roledescription="__('slide')"
				:aria-label="`${i + 1} / ${slides.length}`"
				:aria-hidden="i !== index"
			>
				<p v-if="slide.eyebrow" class="lp-slide-eyebrow">{{ slide.eyebrow }}</p>
				<h2 class="lp-slide-title">{{ slide.title }}</h2>
				<p v-if="slide.text" class="lp-slide-text">{{ slide.text }}</p>
				<div v-if="slide.cta.label && slide.cta.href" class="mt-3">
					<a
						:href="slide.cta.href"
						class="lp-btn-primary no-underline"
						:target="isExternal(slide.cta.href) ? '_blank' : undefined"
						:rel="
							isExternal(slide.cta.href) ? 'noopener noreferrer' : undefined
						"
					>
						{{ slide.cta.label }}
					</a>
				</div>
			</article>

			<div class="lp-carousel-bar">
				<button
					type="button"
					class="lp-arrow"
					:aria-label="__('Previous slide')"
					@click="step(-1)"
				>
					‹
				</button>
				<div class="lp-dots" role="group" :aria-label="__('Choose a slide')">
					<button
						v-for="(slide, i) in slides"
						:key="`dot-${i}`"
						type="button"
						class="lp-dot"
						:aria-label="`${__('Go to slide')} ${i + 1}`"
						:aria-current="i === index ? 'true' : 'false'"
						@click="index = i"
					/>
				</div>
				<button
					type="button"
					class="lp-arrow"
					:aria-label="__('Next slide')"
					@click="step(1)"
				>
					›
				</button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { LandingContent } from '@/pages/Landing/content'

const props = defineProps<{ slides: LandingContent['slides'] }>()

const INTERVAL_MS = 6000
const index = ref(0)
const paused = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const isExternal = (href: string) => href.startsWith('https://')

const reduceMotion = () =>
	typeof window !== 'undefined' &&
	window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function step(delta: number) {
	const count = props.slides.length
	if (!count) return
	index.value = (index.value + delta + count) % count
}

onMounted(() => {
	if (reduceMotion()) return
	timer = setInterval(() => {
		if (!paused.value) step(1)
	}, INTERVAL_MS)
})

onBeforeUnmount(() => {
	if (timer) clearInterval(timer)
})
</script>
