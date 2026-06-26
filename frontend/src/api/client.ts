import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://funza-2027-app.onrender.com';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
