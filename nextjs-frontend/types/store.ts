import { User } from "./user";

export interface Store {
  id: string;
  storeName: string;
  logo?: string;
  description?: string;
  user: User;
}
