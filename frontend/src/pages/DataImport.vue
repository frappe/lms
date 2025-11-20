<template>
    <DataImport 
        :doctype="route.params.doctype"
        :importName="route.params.importName"
        :doctypeMap="doctypeMap"
    />
</template>
<script setup lang="ts">
import { usePageMeta } from "frappe-ui"
import { DataImport } from "frappe-ui/frappe"
import { sessionStore } from '../stores/session'
import { useRoute } from 'vue-router'

const { brand } = sessionStore()
const route = useRoute()

const doctypeMap = {
    "LMS Course": {
        title: "Courses",
        listRoute: "/courses",
        pageRoute: `/courses/docname`
    },
    "LMS Batch": {
        title: "Batches",
        listRoute: "/batches"
    },
    "LMS Category": {
        title: "Categories",
        listRoute: "/lms"
    }
}

usePageMeta(() => {
	return {
		title: __('Data Import'),
		icon: brand.favicon,
	}
})
</script>