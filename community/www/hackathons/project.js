$('#req-evals').on('click', () => {
    frappe.msgprint("The evaluations have been moved to <a href='https://t.me/fossunited'>Telegram</a>")
})
var set_likes = function(liked, likes) {
    let $btn = $('.btn-like');
    $btn.text(`${likes} 👍`); 
    if (liked) {
        $btn.addClass('btn-secondary').removeClass('btn-default');
    } else {
        $btn.addClass('btn-default').removeClass('btn-secondary');
    }
};

// set initial
//set_likes(liked, likes);

// like - unlike
$('.btn-like').on('click', () => {
    frappe.call('like', {project: project}, (data) => { 
        set_likes(data.message.action =="Liked", data.message.likes);
    });
});

// accept / reject
$('.btn-accept').on('click', (ev) => {
    frappe.call('join_request', {id: $(ev.target).attr('data-request-id'), action: 'Accept'}, (data) => { 
        window.location.reload();
    });
});

$('.btn-reject').on('click', (ev) => {
    frappe.call('join_request', {id: $(ev.target).attr('data-request-id'), action: 'Reject'}, (data) => { 
        window.location.reload();
    });
});

$('.btn-leave').on('click', (ev) => {
    frappe.call('join_request', {id: $(ev.target).attr('data-request-id'), action: 'Reject'}, (data) => { 
        window.location.reload();
    });
});