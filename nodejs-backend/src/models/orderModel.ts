export class OrderModel {
  id?: string;
  customerId?: string;
  totalPrice?: Float32Array;
  status?: string;
  createdAt?: string;
  constructor(data: Partial<OrderModel> = {}) {
    this.fill(data);
  }

  fill(data: Partial<OrderModel>) {
    if (data.id !== undefined) this.id = data.id;
    if (data.customerId !== undefined) this.customerId = data.customerId;
    if (data.totalPrice !== undefined) this.totalPrice = data.totalPrice;
    if (data.status !== undefined) this.status = data.status;
    if (data.createdAt !== undefined) this.createdAt = data.createdAt;
  }
}

// model order {
//     id         String       @id @default(uuid())
//     customerId String
//     totalPrice Float
//     status     String
//     createdAt  DateTime     @default(now())
//     customer   customer     @relation(fields: [customerId], references: [id])
//     orderItems order_item[]
//     payment    payment?
//   }
