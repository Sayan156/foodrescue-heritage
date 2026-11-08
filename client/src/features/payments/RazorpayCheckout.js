import { loadScript } from '../../services/api.js';
import { verifyPayment } from './paymentApi.js';

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export async function openRazorpayCheckout({ order, name, email, onVerified, onVerificationError, onFailure }) {
  await loadScript(CHECKOUT_SCRIPT);

  const checkout = new window.Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: 'INR',
    order_id: order.orderId,
    name: 'FoodRescue',
    description: 'Community sponsorship',
    prefill: { name, email },
    theme: { color: '#554638' },
    handler: async (result) => {
      try {
        const response = await verifyPayment({
          orderId: result.razorpay_order_id,
          paymentId: result.razorpay_payment_id,
          signature: result.razorpay_signature,
         
        }, token);
        onVerified?.(response);
      } catch (error) {
        onVerificationError?.(error);
      }
    },
  });

  checkout.on('payment.failed', () => onFailure?.());
  checkout.open();
  return checkout;
}
