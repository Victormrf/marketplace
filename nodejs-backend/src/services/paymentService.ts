import { PaymentModel } from "../models/paymentModel";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";

interface PaymentDate {
  orderId: string;
  amount: number;
  status: string;
}

export class PaymentService {
  async processPayment(orderId: string, amount: number) {
    if (!orderId || !amount) {
      throw new ValidationError("Missing required fields");
    }

    return await PaymentModel.create({
      orderId,
      amount,
      status: "pending",
    });
  }

  async getPaymentDetails(orderId: string) {
    const payment = await PaymentModel.getByOrderId(orderId);

    if (!payment) {
      throw new ObjectNotFoundError("Payment");
    }

    return payment;
  }

  async getPaymentsByCustomer(customerId: string) {
    const payments = await PaymentModel.getByCustomer(customerId);

    if (!payments.length) {
      throw new ObjectsNotFoundError("Payments");
    }

    return payments;
  }

  async updatePayment(paymentId: string, paymentDate: Partial<PaymentDate>) {
    const payment = await PaymentModel.getById(paymentId);

    if (!payment) {
      throw new ObjectNotFoundError("Payment");
    }

    try {
      return await PaymentModel.update(paymentId, paymentDate);
    } catch (error: any) {
      throw new Error(`Failed to update payment: ${(error as Error).message}`);
    }
  }

  async updatePaymentStatus(paymentId: string, status: string) {
    const payment = await PaymentModel.getById(paymentId);

    if (!payment) {
      throw new ObjectNotFoundError("Payment");
    }

    try {
      return await PaymentModel.updateStatus(paymentId, status);
    } catch (error: any) {
      throw new Error(
        `Failed to update payment status: ${(error as Error).message}`
      );
    }
  }

  async deletePayment(paymentId: string) {
    const payment = await PaymentModel.getById(paymentId);

    if (!payment) {
      throw new ObjectNotFoundError("Payment");
    }

    return await PaymentModel.delete(paymentId);
  }
}
