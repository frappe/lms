$('#req-evals').on('click', () => {
    frappe.msgprint("The evaluations have been moved to <a href='https://t.me/fossunited'>Telegram</a>")
})
var set_likes = function (liked, likes) {
    let $btn = $('.btn-like');
    likes ?  $btn.text(`${likes} 👍`): $btn.text(`👍`);
    if (liked) {
        $btn.addClass('btn-dark').removeClass('btn-default');
    } else {
        $btn.addClass('btn-default').removeClass('btn-dark');
    }
};

// set initial likes
frappe.ready(() => {
    var url_params = new URLSearchParams(window.location.search);
    frappe.call('community.www.hackathons.project.like', { project: url_params.get("project"), initial: true }, (data) => {
        set_likes(data.message.action == "Liked", data.message.likes)
    })
})

// like - unlike
$('.btn-like').on('click', (e) => {
    frappe.call('community.www.hackathons.project.like', { project: $(e.target).attr("data-project") }, (data) => {
        set_likes(data.message.action == "Liked", data.message.likes);
    });
});

// accept / reject
$('.btn-accept').on('click', (e) => {
    frappe.call('community.www.hackathons.project.join_request', { id: $(e.target).attr('data-request-id'), action: 'Accept' }, (data) => {
        window.location.reload();
    });
});

$('.btn-reject').on('click', (ev) => {
    frappe.call('community.www.hackathons.project.join_request', { id: $(ev.target).attr('data-request-id'), action: 'Reject' }, (data) => {
        window.location.reload();
    });
});

$('.btn-leave').on('click', (ev) => {
    frappe.call('community.www.hackathons.project.join_request', { id: $(ev.target).attr('data-request-id'), action: 'Reject' }, (data) => {
        window.location.reload();
    });
});