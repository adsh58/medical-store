import axios from "axios";

// Resolve backend base URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;


// Create Axios client pointing to the backend API base path
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to append authorization token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session refresh on 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (typeof window !== "undefined") {
          const refreshToken = localStorage.getItem("refresh_token");
          if (refreshToken) {
            // Call token refresh endpoint to renew tokens
            const response = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              {},
              {
                headers: { Authorization: `Bearer ${refreshToken}` }
              }
            );
            const { access_token, refresh_token } = response.data;
            localStorage.setItem("access_token", access_token);
            if (refresh_token) {
              localStorage.setItem("refresh_token", refresh_token);
            }
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
