function handleDropdownChange() {
    frappe.call({
        method: "lms.www.courses.index.filtered_data",
        args: {
            filter: checkedValues,
        },
        callback: function(response) {
            if (response.message) {
                createCourseCard(response.message);
            } else {
                console.error("Error:", response.exc);
            }
        }
    });
}

function createCourseCard(courseData) {
    const course = courseData;
    var liveCourseCountElement1 = document.getElementById("live-count");
    liveCourseCountElement1.textContent = course[0].length;
    var liveCourseCountElement2 = document.getElementById("upcoming-count");
    liveCourseCountElement2.textContent = course[1].length;
    if(course[2] != 'None'){
        var liveCourseCountElement3 = document.getElementById("created-count");
        liveCourseCountElement3.textContent = course[2].length;
    }
    var liveCourseCountElement4 = document.getElementById("enrolled-count");
    liveCourseCountElement4.textContent = course[3].length;

    const user = frappe.session.user;
    const is_instructor = false;
    const read_only = false;
    const get_profile_url = (username) => `/profile/${username}`;
    const get_lesson_url = (courseName, lessonIndex) => `/courses/${courseName}/learn/${lessonIndex}`;
    const fmt_money = (amount, decimals, currency) => `${currency} ${amount.toFixed(decimals)}`;
    
    const generateCourseCardHtml = (course) => `
        <div class="common-card-style course-card" data-course="${course.name}" data-rating="${course.avg_rating}"
            data-enrollment="${course.enrollment_count}" data-creation="${course.creation}">

            <div class="course-image ${!course.image ? "default-image" : ""}"
                ${course.image ? `style="background-image: url('${course.image}');"` : ""}>
                <div class="course-tags">
                    ${Array.isArray(course.tag) && course.tag.length > 0 ?
                        (() => {
                            return (course.tag).map(tag => `<div class="course-card-pills">${tag}</div>`).join('');
                        })() :
                        ""
                    }
                </div>
                ${!course.image ? `<div class="default-image-text">${(course.title)[0]}</div>` : ""}
            </div>

            <div class="course-card-content">
                <div class="course-card-meta">
                    ${course.get_lesson_count ? `
                    <div class="vertically-center">
                        <svg class="icon icon-md">
                            <use href="#icon-education"></use>
                        </svg>
                        ${course.get_lesson_count}
                    </div>` : ""}
                    
                    ${course.status && course.status !== "Approved" ? `
                    <div class="pull-right indicator-pill ${course.status === "In Progress" ? "gray" : "orange"}">
                        ${course.status}
                    </div>` : ""}
                    
                    ${course.enrollment_count ? `
                    <div class="vertically-center">
                        <svg class="icon icon-md">
                            <use href="#icon-users"></use>
                        </svg>
                        ${course.enrollment_count}
                    </div>` : ""}
                    
                    ${course.avg_rating ? `
                    <div class="vertically-center">
                        <svg class="icon icon-md">
                            <use href="#icon-star"></use>
                        </svg>
                        ${parseFloat(course.avg_rating).toFixed(3)}
                    </div>` : ""}
                </div>

                <div class="course-card-title">${course.title}</div>
                <div class="short-introduction">${course.short_introduction}</div>
                
                ${course.membership && !is_instructor && !read_only ? `
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" aria-valuenow="${course.membership ? course.progress : 0}"
                            aria-valuemin="0" aria-valuemax="100" style="width: ${course.membership ? course.progress + '%' : '0%'}">
                            <span class="sr-only">${course.membership ? course.progress : 0} Complete</span>
                        </div>
                    </div>
                    <div class="progress-percent">${course.membership ? course.progress : 0}% Completed</div>
                ` : ''}
            
                <div class="course-card-footer">
                    <div class="course-card-instructors">
                        ${Array.isArray(course.get_instructors) && (course.get_instructors).length > 0 ?
                            `
                            ${(course.get_instructors).map((instructor, index, array) => `
                                ${array.length > 1 && index === 0 ? `<div class="avatar-group overlap">` : ""}
                                <span class="avatar avatar-small" title=${(course.get_instructors)[0].username}>
                                <a class="button-links" href="/users/"+${(course.get_instructors)[0].username}>
                                    
                                    <span class="avatar-frame standard-image" title="${(course.get_instructors)[0].username}" style="background-color: var(--dark-green-avatar-bg); color: var(--dark-green-avatar-color);">
                                        A
                                    </span>
                                    
                                </a>
                            </span>
                            `).join('')}
                            <a class="button-links" href="${get_profile_url((course.get_instructors)[0].username)}">
                                <span class="course-instructor">
                                    ${(course.get_instructors).length === 1 ? `${(course.get_instructors)[0].full_name}` : `
                                    ${(course.get_instructors)[0].full_name.split(" ")[0]} and ${(course.get_instructors).length - 1} ${(course.get_instructors).length - 1 === 1 ? "other" : "others"}`}
                                </span>
                            </a>
                            ` : ''}
                    </div>
                    <div class="course-price">
                        ${course.paid_course ? fmt_money(course.course_price, 0, course.currency) : "Free"}
                    </div>
                </div>
                ${read_only ? `
                <a class="stretched-link" href="/courses/${course.name}"></a>` : `
                ${(course.progress) !== 100 && course.membership && !course.upcoming ? `
                <a class="stretched-link" href="${get_lesson_url(course.name, course.lesson_index)}${(course.membership).batch_old ? `?batch=${(course.membership).batch_old}` : ""}"></a>` : `
                <a class="stretched-link" href="/courses/${course.name}"></a>`}
                `}
            </div>
        </div>
    `;
    

    function displayCourses(course, title_class, tag){
        const parentElement_live = document.querySelector(title_class);
        parentElement_live.innerHTML = "";
        // Create the div element
        const courseCardsParentDiv = document.createElement('div');
        courseCardsParentDiv.classList.add('course-cards-parent', 'cards-parent');

        // Append the div element to parentElement_live
        parentElement_live.appendChild(courseCardsParentDiv);
        if(course.length <= 0){
            createEmptyState(tag,title_class);
        }else{
            course.forEach(async (course) => {
                try {
                    const get_tags = await fetchdata(course.name, 'get_tags');

                    const get_lesson_count = await fetchdata(course.name, 'get_lesson_count');

                    const get_instructors = await fetchdata(course.name, 'get_instructors');
                    const membership = await fetchdata(course.name,'membership');
                    if(membership[0]){
                        lesson = membership[0].current_lesson
                    }else{
                        lesson = '1.1'
                    }
                    const get_lesson_index = await fetchdata(lesson,'get_lesson_index');
                    course.tag = get_tags;
                    course.get_lesson_count = get_lesson_count;
                    course.get_instructors = get_instructors;
                    course.membership = membership[0]
                    course.progress = membership[1]
                    course.lesson_index = get_lesson_index

                    const courseCardHtml = generateCourseCardHtml(course);
                    const courseCardElement = document.createElement('div');
                    courseCardElement.innerHTML += courseCardHtml;
                    courseCardsParentDiv.appendChild(courseCardElement);
                } catch (error) {
                    console.error("Error fetching data:", error);
                }
            }); 
        }
    
    }
    displayCourses(course[0], '.live-courses', 'Live Courses');
    displayCourses(course[1], '.upcoming-courses', 'Upcoming Courses');
    if(course[2]!= 'None'){
        displayCourses(course[2], '.created-courses', 'Created Courses');
    }
    displayCourses(course[3], '.enrolled-courses', 'Enrolled Courses');


}

function fetchdata(coursename, tag) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "lms.lms.search_filter." + tag,
            args: {
                course: coursename,
            },
            callback: function(response) {                
                resolve(response.message);
                
            },
            error: function(xhr, textStatus, errorThrown) {
                reject(errorThrown || textStatus);
            }
        });
    });
}

function createEmptyState(title, tag) {
    const emptyStateDiv = document.createElement('div');
    emptyStateDiv.classList.add('empty-state');

    const img = document.createElement('img');
    img.classList.add('icon', 'icon-xl');
    img.src = '/assets/lms/icons/comment.svg';

    const emptyStateTextDiv = document.createElement('div');
    emptyStateTextDiv.classList.add('empty-state-text');

    const headingDiv = document.createElement('div');
    headingDiv.classList.add('empty-state-heading');
    headingDiv.textContent = `No ${title}`;

    const metaDiv = document.createElement('div');
    metaDiv.classList.add('course-meta');
    metaDiv.textContent = `There are no ${title.toLowerCase()} on this site.`;

    emptyStateTextDiv.appendChild(headingDiv);
    emptyStateTextDiv.appendChild(metaDiv);
    emptyStateDiv.appendChild(img);
    emptyStateDiv.appendChild(emptyStateTextDiv);

    const container = document.querySelector(tag);
    container.appendChild(emptyStateDiv);
}

const checkboxes = document.querySelectorAll('.filter1');
const checkedValues = {};
checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
        const filterKey = checkbox.dataset.filter;
        if (!checkedValues[filterKey]) {
            checkedValues[filterKey] = [];
        }
        if (checkbox.checked) {
            checkedValues[filterKey].push(checkbox.value);
        } else {
            checkedValues[filterKey] = checkedValues[filterKey].filter(value => value !== checkbox.value);
        }
        handleDropdownChange()
    });
});

document.getElementById('toggle-filters').addEventListener('click', function() {
    var filtersContainer = document.getElementById('filters-container');
    if (filtersContainer.classList.contains('d-none')) {
        filtersContainer.classList.remove('d-none');
        this.textContent = 'Hide Filters';
    } else {
        filtersContainer.classList.add('d-none');
        this.textContent = 'Show Filters';
    }
});

const toggleButtons = document.querySelectorAll('.toggle-button');
toggleButtons.forEach(button => {
    button.addEventListener('click', function() {
        const contentId = this.id.replace('toggle-button-', 'content-');
        const content = document.getElementById(contentId);

        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            this.classList.add('open');
        } else {
            content.style.display = 'none';
            this.classList.remove('open');
        }
    });
});


