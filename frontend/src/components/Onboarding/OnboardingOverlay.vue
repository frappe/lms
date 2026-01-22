<template>
  <div
    v-if="show"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-white"
  >
    <!-- Top Bar -->
    <div class="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6">
      <div class="flex items-center gap-2">
        <img src="/logo-crop.png" alt="Logo" class="h-8" />
        <img
          src="/cesgs-logo-crop.png"
          alt="CESGS Logo"
          class="h-8"
        />
      </div>
      <button
        @click="handleExit"
        class="text-sm font-medium text-secondary-500 hover:text-secondary-800 transition-colors"
      >
        Exit
      </button>
    </div>

    <!-- Content -->
    <div class="flex flex-col items-center w-full max-w-4xl px-4 text-center">
      <!-- Image/Illustration Area -->
      <div class="mb-12 relative w-full flex items-center justify-center">
        <!-- Placeholder for illustrations based on slide index -->
        <div v-if="currentSlide === 0" class="w-full h-full flex items-center justify-center">
             <!-- Celebration/Welcome Illustration Placeholder -->
            <iframe
            src="https://drive.google.com/file/d/1_dV-jqHgImnb1ubg163d8AvlXQ5d5QIt/preview"
            class="w-full aspect-video"
            allow="autoplay"
            allowfullscreen>
            </iframe>
        </div>
        <div v-if="currentSlide === 1" class="w-full h-full flex items-center justify-center">
             <!-- AI/Features Illustration Placeholder -->
            <img src="/images/undraw_working-together_r43a.png" alt="AI Features Illustration" class="w-full h-80 object-contain">
        </div>
        <div v-if="currentSlide === 2" class="w-full h-full flex items-center justify-center">
             <!-- Teacher/Student Illustration Placeholder -->
             <img src="/images/undraw_online-stats_d57c 1.png" alt="Teacher/Student Illustration" class="w-full h-80 object-contain">
        </div>
        <div v-if="currentSlide === 3" class="w-full h-full flex items-center justify-center">
             <!-- Video/Overview Illustration Placeholder -->
             <img src="/images/undraw_happy-announcement_23nf 1.png" alt="Video/Overview Illustration" class="w-full h-80 object-contain">
        </div>
      </div>

      <!-- Text Content -->
      <h1 class="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
        {{ slides[currentSlide].title }}
      </h1>
      <p class="text-gray-600 text-md mb-12 max-w-4xl mx-auto leading-relaxed">
        {{ slides[currentSlide].description }}
      </p>

      <div class="flex items-center gap-4">
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
          @click="currentSlide === 3 ? handleComplete() : nextSlide()"
          class="min-w-[100px] !bg-primary-500 hover:!bg-primary-600 text-white border-none !rounded w-36 h-12"
        >
          {{ currentSlide === 3 ? 'Continue' : 'Next' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Button } from 'frappe-ui'

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
    description: 'Empowering structured learning in one integrated platform. Brought to you by Center for Environmental, Social, and Governance Studies (CESGS) Universitas Airlangga: the first Center of Excellence for Sustainable Business (PUI PT Bisnis Berkelanjutan) and #1 ESG Research Center in Indonesia.',
  },
  {
    title: 'Sharpen your skills',
    description: 'Enhance your abilities with guided learning and practical, focused improvements',
  },
  {
    title: 'Learn Efficiently With AI Assistance',
    description: 'Get instant support from AI tutors, quick explanations, and smart suggestions to master any topic efficiently',
  },
  {
    title: 'Learn without limits',
    description: 'Explore new knowledge at your own pace and unlock your full potential',
  },
]

const nextSlide = () => {
  // Mark current slide as completed before moving to next
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
  // Mark the last slide as completed
  if (props.updateOnboardingStep) {
     props.updateOnboardingStep('slide_' + (currentSlide.value + 1), true)
  }
  emit('complete')
}

const handleExit = () => {
  emit('exit')
}
</script>
