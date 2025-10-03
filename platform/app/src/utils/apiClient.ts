import axios from 'axios';

type AppWindow = Window & { config?: { NEXT_API_BASE_URL?: string } };
const API_BASE = (window as AppWindow).config?.NEXT_API_BASE_URL as string;

if (!API_BASE) {
  throw new Error('NEXT_API_BASE_URL is not set in window.config');
}

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 50000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  config => {
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    return Promise.reject(error);
  }
);

export default apiClient;
