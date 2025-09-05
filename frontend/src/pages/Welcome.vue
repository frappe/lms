<template>
    <!-- <PdfViewer :pdfUrl="'http://lms.test:8080/test.pdf'" /> -->
    <div class="sm:h-screen w-full flex flex-col gap-8 items-center justify-center text-white px-4 md:px-8 lg:px-12 py-4">
        <div class="text-center flex flex-col md:flex-row items-center gap-4 bg-gradient-to-tr from-blue-800 to-blue-400 p-4 md:p-14 lg:p-32 rounded-lg">
            <div class="flex flex-col gap-4">
                <p class="text-lg md:text-xl lg:text-2xl font-semibold">
                    I'm excited to introduce our new Competency Management System, a direct investment in your growth. This platform will provide clarity on the skills we value and a clear roadmap for your career development. I encourage you to explore it and actively shape your future with us.
    Welcome to this new chapter.
                </p>

                <p class="text-sm sm:text-md font-bold">
                    Pieters Utomo - CEO Soechi Lines
                </p>
            </div>
            <img :src="CeoImg" class="w-32 md:w-40 rounded-full"/>
        </div>

        <div class="text-center flex flex-col md:flex-row items-center gap-4 bg-gradient-to-tr from-blue-400 to-blue-800 p-4 md:p-14 lg:p-32 rounded-lg">
            <img :src="DirectorImg" class="w-32 md:w-40 rounded-full"/>
            <div class="flex flex-col gap-4">
                <p class="text-lg md:text-xl lg:text-2xl font-semibold">
                    I am pleased to announce the launch of our new Competency Management System, designed to align skills with organizational goals and support continuous professional growth. I encourage all employees to actively engage with this platform as we work together to build a stronger, future-ready organization.
                </p>
    
                <p class="text-sm sm:text-md font-bold">
                    Capt. Karan Sawhney
                    Director – Strategic Development & Assurance Soechi Lines
                </p>
            </div>
        </div>
    </div>
</template>
<script setup>
import { computed, inject, watch, ref, onMounted, watchEffect } from 'vue'
import CeoImg from '@/assets/ceo.jpeg';
import DirectorImg from '@/assets/director.jpeg';
import PdfViewer from '@/components/PdfViewer.vue';

onMounted(() => {
    console.log(">>> Mounted called");
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'People',
		},
		// {
		// 	label: profile.data?.full_name,
		// 	route: {
		// 		name: 'Profile',
		// 		params: {
		// 			username: user.doc?.username,
		// 		},
		// 	},
		// },
	]
	return crumbs
})
</script>
