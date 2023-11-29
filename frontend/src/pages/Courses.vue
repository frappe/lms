<template>
   <div class="container">
        <div class="text-2xl font-semibold">
            All Courses
        </div>
        <div class="grid grid-cols-3 gap-8">
            <div v-for="course in courses.data">
                <CourseCard :course="course" />
            </div>
        </div>
   </div>
</template>

<script setup>
import { createListResource } from 'frappe-ui';
import { ref, computed } from 'vue';
import CourseCard from '@/components/CourseCard.vue'

const courses = createListResource({
    type: 'list',
    doctype: 'LMS Course',
    url: "lms.lms.api.get_courses",
    auto: true,
})

</script>