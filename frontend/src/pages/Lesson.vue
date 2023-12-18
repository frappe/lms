<template>
    <div v-if="lesson.data && course.data" class="h-screen text-base">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5">
            <Breadcrumbs class="h-7" :items="breadcrumbs" />
        </header>
        <div class="grid grid-cols-[70%,30%] h-full">
            <div class="border-r-2 container pt-5 pb-10">
                <div class="text-3xl font-semibold">
                    {{ lesson.data.title }}
                </div>
                <div class="flex items-center mt-2">
                    <span class="mr-1" :class="{ 'avatar-group overlap': course.data.instructors.length > 1 }">
                        <UserAvatar v-for="instructor in course.data.instructors" :user="instructor" />
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
                <div v-html="lesson.data.rendered_content" class="lesson-content mt-6"></div>
            </div>
            <div class="sticky top-10">
                <div class="bg-gray-50 p-5 border-b-2">
                    <div class="text-lg font-semibold">
                        {{ course.data.title }}
                    </div>
                    <div v-if="user && course.data.membership" class="text-sm mt-3">
                        {{ Math.ceil(course.data.membership.progress) }}% completed
                    </div>
                    <div v-if="user && course.data.membership" class="w-full bg-gray-200 rounded-full h-1 my-2">
                        <div class="bg-gray-900 h-1 rounded-full"
                            :style="{ width: Math.ceil(course.data.membership.progress) + '%' }"></div>
                    </div>
                </div>
                <CourseOutline :courseName="lesson.data.course" />
            </div>
        </div>
    </div>
</template>
<script setup>
import { createResource, Breadcrumbs } from "frappe-ui";
import { computed, onMounted, onBeforeMount, onUnmounted, inject } from "vue";
import { useStorage } from '@vueuse/core'
import CourseOutline from '@/components/CourseOutline.vue';
import UserAvatar from '@/components/UserAvatar.vue';

const user = inject("$user");

onBeforeMount(() => {
    console.log("before mount");
    localStorage.setItem("sidebar_is_collapsed", true);
})

const props = defineProps({
    courseName: {
        type: String,
        required: true,
    },
    chapterNumber: {
        type: String,
        required: true,
    },
    lessonNumber: {
        type: String,
        required: true,
    },
});

const lesson = createResource({
    url: "lms.lms.utils.get_lesson",
    cache: ["lesson", props.courseName, props.lessonNumber],
    params: {
        course: props.courseName,
        chapter: props.chapterNumber,
        lesson: props.lessonNumber,
    },
    auto: true,
});

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
        route: { name: "CourseDetail", params: { course: props.courseName } },
    })
    items.push({
        label: lesson?.data?.title,
        route: { name: "Lesson", params: { course: props.courseName, chapterNumber: props.chapterNumber, lessonNumber: props.lessonNumber } },
    })
    return items
});
onUnmounted(() => {
    console.log("unmounted");
    useStorage("sidebar_is_collapsed", false);
});
</script>
<style>
.youtube-video {
    border: 1px solid #ddd;
}

.avatar-group {
    display: inline-flex;
    align-items: center;
}

.avatar-group .avatar {
    transition: margin 0.1s ease-in-out;
}

iframe {
    border-radius: 0.5rem;
}

.lesson-content div {
    margin-bottom: 1rem;
}

.lesson-content p {
    margin-bottom: 1rem;
    line-height: 1.7;
}
</style>