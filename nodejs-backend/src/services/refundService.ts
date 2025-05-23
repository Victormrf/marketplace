import { RefundModel } from "../models/refundModel";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";

interface RefundData {
  paymentId: string;
  reason: string;
  amount: number;
  status: string;
}

export class RefundService {
  async requestRefund(paymentId: string, reason: string, amount: number) {
    if (!paymentId || !reason || !amount) {
      throw new ValidationError("Missing required fields");
    }

    return await RefundModel.create({
      paymentId,
      reason,
      amount,
      status: "REQUESTED",
    });
  }

  async getRefundById(refundId: string) {
    const refund = await RefundModel.getById(refundId);
    if (!refund) throw new ObjectNotFoundError("Refund");
    return refund;
  }

  //   async getRefundsByCustomer(customerId: string) {
  //     const refunds = await RefundModel.getByCustomer(customerId);
  //     if (!refunds.length) throw new ObjectsNotFoundError("Refunds");
  //     return refunds;
  //   }

  async updateRefundStatus(refundId: string, status: string) {
    const refund = await RefundModel.getById(refundId);
    if (!refund) throw new ObjectNotFoundError("Refund");

    return await RefundModel.updateStatus(
      refundId,
      status as "APPROVED" | "REJECTED"
    );
  }

  async deleteRefund(refundId: string) {
    const refund = await RefundModel.getById(refundId);
    if (!refund) throw new ObjectNotFoundError("Refund");

    return await RefundModel.delete(refundId);
  }
}
