import frappe

def get_context(context):
    context.threads = get_threads()

def get_threads():
    threads = frappe.get_all("Discussion Thread", fields=["name", "title"])
    for thread in threads:
        messages = frappe.get_all("Discussion Message",
                        {
                            "thread": thread.name
                        },
                        ["owner"],
                        as_list=True)
        thread.message_count = len(messages)
        thread.member_count = len(set(messages))
    return threads
