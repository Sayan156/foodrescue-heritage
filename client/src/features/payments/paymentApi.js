import { api } from '../../services/api.js';

export function createPaymentOrder(payload,token) {
  return api('/payments/create-order', { method: 'POST', body: payload,token });
}

export function verifyPayment(payload,token) {
  return api('/payments/verify', { method: 'POST', body: payload,token });
}

export function getPaymentConfig() {
  return api('/payments/config');
}
