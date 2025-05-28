export interface User {
    data: {
        email: string
        name: string
        enabled: boolean
        user_image: string
        full_name: string
        user_type: ['System User', 'Website User']
        username: string
        is_moderator: boolean
        is_system_manager: boolean
        is_evaluator: boolean
        is_instructor: boolean
        is_fc_site: boolean
    }
}