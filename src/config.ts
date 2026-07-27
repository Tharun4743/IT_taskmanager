export const ENV = Object.freeze({
    API_URL: import.meta.env.VITE_API_URL || "/api",
    IS_PRODUCTION: true,
    AUTH_TOKEN_STORAGE_KEY: "vsbec_auth_token",
    AUTH_HEADER_NAME: "Authorization",
    AUTH_SCHEME: "Bearer",
    CONTENT_TYPE: "application/json"
});

export const API_URL = ENV.API_URL.replace(/\/api\/?$/, '');
