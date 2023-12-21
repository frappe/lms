<template>
    <div v-if="course.data" class="h-screen text-base">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5">
            <Breadcrumbs
                class="h-7"
                :items="breadcrumbs"
            />
        </header>
        <div class="m-5">
            <div>
                <div class="text-3xl font-semibold">
                    {{ course.data.title }}
                </div>
                 <div class="mt-1">
                    {{ course.data.short_introduction }}
                </div>
                <div class="flex items-center justify-between mt-3 w-1/3">
                    <div v-if="course.data.avg_rating" class="flex items-center">
                        <Star class="h-5 w-5 text-gray-100 fill-orange-500"/>
                        <span class="ml-1">
                            {{ course.data.avg_rating }}
                        </span>
                    </div>
                    <span v-if="course.data.avg_rating">&middot;</span>
                    <div v-if="course.data.enrollment_count" class="flex items-center">
                        <Users class="h-4 w-4 text-gray-700"/>
                        <span class="ml-1">
                            {{ course.data.enrollment_count_formatted }}
                        </span>
                    </div>
                    <span v-if="course.data.enrollment_count">&middot;</span>
                    <div class="flex items-center">
                        <span class="mr-1" :class="{ 'avatar-group overlap': course.data.instructors.length > 1 }">
                            <UserAvatar v-for="instructor in course.data.instructors" :user="instructor"/>
                        </span>
                        <span v-if="course.data.instructors.length == 1">
                            {{ course.data.instructors[0].full_name }}
                        </span>
                        <span v-if="course.data.instructors.length == 2">
                            {{ course.data.instructors[0].first_name }} and {{ course.data.instructors[1].first_name }}
                        </span>
                        <span v-if="course.data.instructors.length > 2">
                            {{ course.data.instructors[0].first_name }} and {{ course.data.instructors.length - 1 }} others
                        </span>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-[60%,20%] gap-20 mt-10">
                <div class="">
                    <div v-html="course.data.description" class="course-description"></div>
                    <div class="mt-10">
                         <div class="text-2xl font-semibold">
                            {{ __("Course Content") }}
                        </div>
                        <CourseOutline :courseName="course.data.name"/>
                    </div>
                    <CourseReviews v-if="course.data.avg_rating" :courseName="course.data.name" :avg_rating="course.data.avg_rating" :membership="course.data.membership"/>
                </div>
                <div>
                    <CourseCardOverlay :course="course"/>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { createResource, Breadcrumbs } from "frappe-ui";
import { computed } from "vue";
import { Users, Star } from 'lucide-vue-next'
import CourseCardOverlay from '@/components/CourseCardOverlay.vue';
import CourseOutline from '@/components/CourseOutline.vue';
import CourseReviews from '@/components/CourseReviews.vue';
import UserAvatar from '@/components/UserAvatar.vue'

const props = defineProps({
    courseName: {
        type: String,
        required: true,
    },
})

const course = createResource({
    url: "lms.lms.utils.get_course_details",
    cache: ["course", props.courseName],
    params: {
        course: props.courseName
    },
    auto: true,
});

const breadcrumbs = computed(() => {
    let items = [{ label: "All Courses", route: { name: "Courses" } }]
    items.push({
        label: course?.data?.title,
        route: { name: "CourseDetail", params: { course: course?.data?.name } },
    })
    return items
})
</script>
<style>
.course-description p {
    margin-bottom: 1rem;
    line-height: 1.7;
}
.course-description li {
    line-height: 1.7;
}

.course-description ol {
    list-style: auto;
    margin: revert;
    padding: revert;
}

.avatar-group {
    display: inline-flex;
    align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}
</style>