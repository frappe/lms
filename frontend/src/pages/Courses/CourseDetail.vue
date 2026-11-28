<template>
	<CoursePage ref="page" :key="courseName" :courseName="courseName" />
	<router-view />
</template>

<script setup lang="ts">
import { provide, useTemplateRef } from 'vue'
import CoursePage from '@/pages/Courses/CoursePage.vue'

/** Keyed so a jump from one course to another starts with fresh form state. */
defineProps<{ courseName: string }>()

const page = useTemplateRef<{ reloadCourse: () => void }>('page')
provide('reloadCourseDetails', () => page.value?.reloadCourse())
</script>
