<template>
  <div class="h-screen">
    <header
          class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
        >
          <Breadcrumbs
            class="h-7"
            :items="[{ label: __('All Courses'), route: { name: 'Courses' } }]"
          />
          <div class="flex">
            <Select class="mr-2"
              :options="orderOptions"
              v-model="orderBy"
            />
            <Button variant="solid">
              <template #prefix>
                <Plus class="h-4 w-4" />
              </template>
              New Course
            </Button>
          </div>
        </header>
     <div class="mx-5 my-10">
      <Tabs class="overflow-hidden" v-model="tabIndex" :tabs="tabs">
        <template #tab="{ tab, selected }">
          <div>
            <button
              class="group -mb-px flex items-center gap-2 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900"
              :class="{ 'text-gray-900': selected }"
            >
              <component v-if="tab.icon" :is="tab.icon" class="h-5" />
              {{ tab.label }}
              <Badge
                :class="{ 'text-gray-900 border border-gray-900': selected }"
                variant="subtle"
                theme="gray"
                size="sm"
              >
                {{ tab.count }}
              </Badge>
            </button>
          </div>
        </template>
        <template #default="{ tab }">
          <div class="grid grid-cols-3 gap-8 mt-5" v-if="tab.courses && tab.courses.value.length">
            <router-link v-for="course in tab.courses.value" :to="{ name: 'CourseDetail', params: { course: course.name } }">
              <CourseCard :course="course" />
            </router-link>
          </div>
          <div v-else class="grid flex-1 place-items-center text-xl font-medium text-gray-500">
            <div class="flex flex-col items-center justify-center mt-4">
              <div>No {{ tab.label.toLowerCase() }} courses found</div>
            </div>
          </div>
        </template>
      </Tabs>
    </div>
  </div>
    
</template>

<script setup>
import { createListResource, Breadcrumbs, Tabs, Badge, Select } from 'frappe-ui';
import CourseCard from '@/components/CourseCard.vue';
import { Plus } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { usersStore } from '@/stores/user'
import { sessionStore } from '@/stores/session'

const { isLoggedIn } = sessionStore()
const { getUser } = usersStore()
const user = computed(() => isLoggedIn && getUser())

const courses = createListResource({
  type: 'list',
  cache: "courses",
  doctype: 'LMS Course',
  url: "lms.lms.utils.get_courses",
  auto: true,
});

const tabIndex = ref(0)
const tabs = [
  {
    label: 'Live',
    courses: computed(() => courses.data?.live || []),
    count: computed(() => courses.data?.live?.length),
    show: true
  },
  {
    label: 'Upcoming',
    courses: computed(() => courses.data?.upcoming),
    count: computed(() => courses.data?.upcoming?.length),
    show: true
  },
  {
    label: 'Enrolled',
    courses: computed(() => courses.data?.enrolled),
    count: computed(() => courses.data?.enrolled?.length),
    show: user
  },
  {
    label: 'Created',
    courses: computed(() => courses.data?.created),
    count: computed(() => courses.data?.created?.length),
    show: computed(() => user && (user.roles.includes('Course Creator') || user.roles.includes('Moderator')))
  },
  {
    label: 'Under Review',
    courses: computed(() => courses.data?.under_review),
    count: computed(() => courses.data?.under_review?.length),
    show: computed(() => user && user.roles.includes('Moderator'))
  },
];

const orderOptions = [
  {
    label: "Sort By",
    disabled: 1
  },
  {
    label: "Most Popular",
    value: "enrollment"
  },
  {
    label: "Highest Rated",
    value: "rating"
  },
  {
    label: "Newest",
    value: "creation"
  },
];
const orderBy = 'enrollment';

function sort_courses(order) {
  const categories = ['live', 'upcoming', 'enrolled', 'created', 'under_review'];
  categories.forEach(category => {
    console.log(courses.data)
    courses.data[category] = courses.data[category].sort((a, b) => {
      if (order === 'enrollment') {
        return b.enrollment_count - a.enrollment_count;
      } else if (order === 'rating') {
        return b.avg_rating - a.avg_rating;
      } else if (order === 'newest') {
        return new Date(b.creation).getTime() - new Date(a.creation).getTime();
      }
    });
  });
}
</script>