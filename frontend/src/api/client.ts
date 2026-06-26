import axios from 'axios';

const PRODUCTION_API_URL = 'https://funza-2027-app.onrender.com';
const DEVELOPMENT_API_URL = 'http://localhost:8521';
const configuredApiUrl = import.meta.env.VITE_API_URL || '';
const isLocalApiUrl = /localhost|127\.0\.0\.1|192\.168\.|10\.0\.|172\.(1[6-9]|2\d|3[0-1])\./.test(configuredApiUrl);

export const API_BASE_URL =
  configuredApiUrl && !(import.meta.env.PROD && isLocalApiUrl)
    ? configuredApiUrl
    : import.meta.env.DEV
      ? DEVELOPMENT_API_URL
      : PRODUCTION_API_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
