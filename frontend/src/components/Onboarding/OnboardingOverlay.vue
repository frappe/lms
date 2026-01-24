<template>
	<div
		v-if="show"
		class="fixed inset-0 z-[100] bg-white flex flex-col overflow-y-auto"
	>
		<div
			class="flex items-center justify-between px-8 py-4 w-full border-b h-16 sticky top-0 bg-white z-20"
		>
			<div class="flex items-center gap-2">
				<img src="/logo-crop.png" alt="Logo" class="h-8" />
				<img src="/cesgs-logo-crop.png" alt="CESGS Logo" class="h-8" />
			</div>
			<button
				@click="handleExit"
				class="text-sm font-medium text-secondary-500 hover:text-secondary-800 transition-colors"
			>
				Exit
			</button>
		</div>

		<div class="w-full flex-1 flex flex-col pt-4">
			<div class="w-full overflow-hidden relative">
				<div
					class="flex transition-transform duration-700 ease-in-out w-full"
					:style="{ transform: `translateX(-${currentSlide * 100}%)` }"
				>
					<div
						v-for="(slide, index) in slides"
						:key="index"
						class="w-full flex-shrink-0 px-8 py-2 flex items-center justify-center"
					>
						<div class="max-w-3xl mx-auto flex flex-col items-center w-full">
							<div
								class="mb-12 relative w-full flex items-center justify-center"
							>
								<div
									v-if="slide.type === 'video' && slide.videoUrl"
									class="w-full flex items-center justify-center"
								>
									<iframe
										:src="slide.videoUrl"
										class="aspect-video w-full"
										allow="autoplay"
										allowfullscreen
									>
									</iframe>
								</div>
								<div
									v-else-if="slide.type === 'image' && slide.imageUrl"
									class="w-full flex items-center justify-center"
								>
									<img
										:src="slide.imageUrl"
										:alt="slide.title"
										class="w-full h-80 object-contain"
									/>
								</div>
							</div>

							<h1
								class="text-lg sm:text-3xl font-bold text-gray-900 mb-4 tracking-tight text-center"
							>
								{{ slide.title }}
							</h1>
							<p
								class="text-gray-600 text-xs sm:text-base max-w-4xl mx-auto leading-relaxed text-center"
							>
								{{ slide.description }}
							</p>
						</div>
					</div>
				</div>
			</div>
			<div class="p-8 pb-20 w-full mt-auto">
				<div class="max-w-3xl mx-auto flex items-center justify-center gap-4">
					<Button
						v-if="currentSlide > 0"
						variant="outline"
						size="lg"
						@click="prevSlide"
						class="min-w-[100px] border-primary-500 text-primary-500 hover:bg-primary-50 !rounded w-36 h-12"
					>
						Back
					</Button>
					<Button
						variant="solid"
						size="lg"
						@click="
							currentSlide === slides.length - 1
								? handleComplete()
								: nextSlide()
						"
						class="min-w-[100px] !bg-primary-500 hover:!bg-primary-600 text-white border-none !rounded w-36 h-12"
					>
						{{ currentSlide === slides.length - 1 ? 'Continue' : 'Next' }}
					</Button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref } from 'vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
	show: {
		type: Boolean,
		default: false,
	},
	updateOnboardingStep: {
		type: Function,
		default: () => {},
	},
})

const emit = defineEmits(['complete', 'exit'])

const currentSlide = ref(0)

const slides = [
	{
		title: 'CESGS Learning Management System',
		description:
			'Empowering structured learning in one integrated platform. Brought to you by Center for Environmental, Social, and Governance Studies (CESGS) Universitas Airlangga: the first Center of Excellence for Sustainable Business (PUI PT Bisnis Berkelanjutan) and #1 ESG Research Center in Indonesia.',
		videoUrl:
			'https://drive.google.com/file/d/1_dV-jqHgImnb1ubg163d8AvlXQ5d5QIt/preview',
		type: 'video',
	},
	{
		title: 'Sharpen your skills',
		description:
			'Enhance your abilities with guided learning and practical, focused improvements',
		imageUrl: '/images/undraw_working-together_r43a.png',
		type: 'image',
	},
	{
		title: 'Learn Efficiently With AI Assistance',
		description:
			'Get instant support from AI tutors, quick explanations, and smart suggestions to master any topic efficiently',
		imageUrl: '/images/undraw_online-stats_d57c 1.png',
		type: 'image',
	},
	{
		title: 'Learn without limits',
		description:
			'Explore new knowledge at your own pace and unlock your full potential',
		imageUrl: '/images/undraw_happy-announcement_23nf 1.png',
		type: 'image',
	},
]

const nextSlide = () => {
	if (props.updateOnboardingStep) {
		props.updateOnboardingStep('slide_' + (currentSlide.value + 1), true)
	}

	if (currentSlide.value < slides.length - 1) {
		currentSlide.value++
	} else {
		handleComplete()
	}
}

const prevSlide = () => {
	if (currentSlide.value > 0) {
		currentSlide.value--
	}
}

const handleComplete = () => {
	if (props.updateOnboardingStep) {
		props.updateOnboardingStep('slide_' + (currentSlide.value + 1), true)
	}
	emit('complete')
}

const handleExit = () => {
	emit('exit')
}
</script>
