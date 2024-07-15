function handleDropdownChange() {
    frappe.call({
        method: "lms.www.batches.index.filtered_data",
        args: {
            filter: checkedValues,
        },
        callback: function(response) {
            if (response.message) {
                createBatchCard(response.message);
            } else {
                console.error("Error:", response.exc);
            }
        }
    });
}

function createBatchCard(batchData) {
    const batches = batchData;
    var liveBatchCountElement1 = document.getElementById("upcoming-batch");
    liveBatchCountElement1.textContent = batches[0].length;
    var liveBatchCountElement2 = document.getElementById("past-batch");
    liveBatchCountElement2.textContent = batches[1].length;
    if(batches[2] != 'None'){
        var liveBatchCountElement3 = document.getElementById("private-batch");
        liveBatchCountElement3.textContent = batches[2].length;
    }
    var liveBatchCountElement4 = document.getElementById("batch-count");
    liveBatchCountElement4.textContent = batches[3].length;

    function isStudent(batchName) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'lms.www.batches.index.is_student_',
                args: {
                    batch: batchName,
                },
                callback: function(response) {
                    resolve(response.message);
                }
            });
        });
    }

    function formatMoney(amount, currency) {
        return `${currency} ${amount.toFixed(0)}`;
    }

    function formatDate(date, format) {
        const options = format === "medium" ? { year: 'numeric', month: 'short', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(date).toLocaleDateString(undefined, options);
    }

    function format_time(time) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'lms.www.batches.index.get_time',
                args: {
                    batch: time,
                },
                callback: function(response) {
                    if (response.message) {
                        resolve(response.message);
                    } else {
                        reject(new Error('Failed to get formatted time.'));
                    }
                }
            });
        });
    }

    const generateBatchCardHtml = async(batch) => {
        const startFormatted = await format_time(batch.start_time);
        const endFormatted = await format_time(batch.end_time);
        const is_student = await isStudent(batch.name);
        return `
        <div class="common-card-style column-card" style="min-height: 150px;">
            ${batch.seat_count ? `
                <div class="indicator-pill ${batch.seats_left > 0 ? 'green' : 'red'} align-self-start mb-2">
                    ${batch.seats_left > 0 ? 'Seats Available: ' + batch.seats_left : 'No Seats Left'}
                </div>` : ''}
            <div class="bold-heading">${batch.title}</div>
            ${batch.description ? `<div class="short-introduction">${batch.description}</div>` : ''}
            ${batch.paid_batch ? `<div class="bold-heading mb-2">${formatMoney(batch.amount, batch.currency)}</div>` : ''}
            <div class="mt-auto mb-2">
                <svg class="icon icon-sm"><use href="#icon-calendar"></use></svg>
                <span>${formatDate(batch.start_date, "medium")}</span>
                ${batch.start_date !== batch.end_date ? `<span> - ${formatDate(batch.end_date, "long")}</span>` : ''}
            </div>
            <div class="mb-2">
                <svg class="icon icon-sm"><use href="#icon-clock"></use></svg>
                <span>${startFormatted} - ${endFormatted}</span></div>
            <div class="mb-2">
                <svg class="icon icon-md"><use href="#icon-education"></use></svg>
                ${batch.course_count} Courses
            </div>
            <a class="stretched-link" href="${is_student ? `/batches/${batch.name}` : `/batches/details/${batch.name}`}"></a>
        </div>
    `;   } 

    async function displayBatches(batch, title_class){
        const parentElement_live = document.getElementById(title_class);
        parentElement_live.innerHTML = "";
        if (batch.length) {
            try {
                const formattedBatches = await Promise.all(batch.map(async (batch) => {
                    return await generateBatchCardHtml(batch);
                }));
    
                const batchCards = formattedBatches.join('');
                parentElement_live.innerHTML = `<div class="lms-card-parent">${batchCards}</div>`;
            } catch (error) {
                console.error('Error fetching batch details:', error);
                parentElement_live.innerHTML = `<p class="text-muted mt-3">Failed to load batches</p>`;
            }
        } else {
            parentElement_live.innerHTML = `<p class="text-muted mt-3">No batches</p>`;
        }
    }
    
    displayBatches(batches[0], 'upcoming');
    displayBatches(batches[1], 'past');
    if(batches[2]!= 'None'){
        displayBatches(batches[2], 'private');
    }
    displayBatches(batches[3], 'my-batch');

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
