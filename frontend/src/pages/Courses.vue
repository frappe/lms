<template>
    <header
        class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
      >
        <Breadcrumbs
          class="h-7"
          :items="[{ label: 'All Courses', route: { name: 'Courses' } }]"
        />
        <Button variant="solid">
          <template #prefix>
            <Plus class="h-4 w-4" />
        </template>
          New Course
        </Button>
      </header>
   <div class="mx-5 my-10">
      <Tabs class="overflow-hidden" v-model="tabIndex" :tabs="tabs">
        <template #tab="{ tab, selected }">
          <button
            class="group -mb-px flex items-center gap-2 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900"
            :class="{ 'text-gray-900': selected }"
          >
            <component v-if="tab.icon" :is="tab.icon" class="h-5" />
            {{ tab.label }}
            <Badge
              class="group-hover:bg-gray-900"
              :class="[selected ? 'bg-gray-900' : 'bg-gray-600']"
              variant="solid"
              theme="gray"
              size="sm"
            >
              {{ tab.count }}
            </Badge>
          </button>
        </template>
        <template #default="{ tab }">
          <div class="grid grid-cols-3 gap-8 mt-5" v-if="tab.courses && tab.courses.value.length">
            <div v-for="course in tab.courses.value">
              <CourseCard :course="course" />
            </div>
          </div>
          <div v-else class="grid flex-1 place-items-center text-xl font-medium text-gray-500">
            <div class="flex flex-col items-center justify-center mt-4">
              <div>No {{ tab.label.toLowerCase() }} courses found</div>
            </div>
          </div>
        </template>
      </Tabs>
  </div>
</template>

<script setup>
import { createListResource, Breadcrumbs, Tabs, Badge } from 'frappe-ui';
import CourseCard from '@/components/CourseCard.vue';
import { Plus } from 'lucide-vue-next'
import { ref, computed, watchEffect } from 'vue'

const courses = createListResource({
  type: 'list',
  cache: "courses",
  doctype: 'LMS Course',
  url: "lms.lms.utils.get_courses",
  auto: true,
})

const tabIndex = ref(0)
const tabs = [
  {
    label: 'Live',
    courses: computed(() => {
      return courses.data?.live || []
    }),
    count: computed(() => courses.data?.live?.length),
  },
  {
    label: 'Upcoming',
    courses: computed(() => courses.data?.upcoming),
    count: computed(() => courses.data?.upcoming?.length),
  },
  {
    label: 'Enrolled',
    courses: computed(() => courses.data?.enrolled),
    count: computed(() => courses.data?.enrolled?.length),
  },
  {
    label: 'Created',
    courses: computed(() => courses.data?.created),
    count: computed(() => courses.data?.created?.length),
  },
  {
    label: 'Under Review',
    courses: computed(() => courses.data?.under_review),
    count: computed(() => courses.data?.under_review?.length),
  },
]
</script>