import { getToken, clearToken } from './api.js';

export function isAuthenticated() {
  return !!getToken();
}

export function logout() {
  clearToken();
  window.location.replace('/marketplace');
}
