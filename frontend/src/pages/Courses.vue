<template>
   <div class="container">
        <div class="text-xl font-semibold">
                All Courses
            </div>
            <div>
                {{ courses }}
            </div>
   </div>
</template>

<script>
export default {
    name: "Courses",
    resources: {
        courses() {
            return {
                type: "list",
                doctype: "LMS Course",
                fields: ["name", "title", "short_introduction", "image"],
                orderBy: "creation desc",
                filters: {
                    published: 1
                },
                transform(data) {
                    return data.map((course) => {
                        course.data = JSON.parse(course.data)
                        return course
                    })
                },
            }
        }
    },
    computed: {
        courses() {
            console.log(this.courses)
        }
    }
}
</script>