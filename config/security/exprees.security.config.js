'use strict'

const config = {
    max_body_size: '100kb',
    cors: [
        //if empty all origins are ok
    ],
    rate_limit: {
        enabled: true,
        max_request_min: 100,
        protected_routes: [
            '/apiv2',
            '/apiv3',
            '/api/auth'
        ],
        ip_whitelist: [
            "127.0.0.1"
        ],
        route_whitelist: [
            '/apiv2/events/event'
        ],
        login_max_req: 5, //it can make 5 requests in 60min for example
        login_interval_req_in_minutes: 30, //these are the min that the user can make max login req
        login_block_duration: 30, //30min,
        forgot_password_max_req: 5,
        forgot_password_duration: 60
    }
}

module.exports = config
