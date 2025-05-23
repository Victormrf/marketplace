import { PaymentModel } from "../models/paymentModel";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";

type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED"; // Enum possível

interface PaymentData {
  orderId: string;
  amount: number;
  status: PaymentStatus;
}

export class PaymentService {
  async processPayment(orderId: string, amount: number) {
    if (!orderId || typeof amount !== "number" || amount <= 0) {
      throw new ValidationError("Missing or invalid required fields");
    }

    return await PaymentModel.create({
      orderId,
      amount,
      status: "PENDING",
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

  async updatePayment(paymentId: string, data: Partial<PaymentData>) {
    const payment = await PaymentModel.getById(paymentId);

    if (!payment) {
      throw new ObjectNotFoundError("Payment");
    }

    try {
      return await PaymentModel.update(paymentId, data);
    } catch (error: any) {
      throw new Error(`Failed to update payment: ${error.message}`);
    }
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus) {
    const payment = await PaymentModel.getById(paymentId);

    if (!payment) {
      throw new ObjectNotFoundError("Payment");
    }

    try {
      return await PaymentModel.updateStatus(paymentId, status);
    } catch (error: any) {
      throw new Error(`Failed to update payment status: ${error.message}`);
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
