import * as userModel from "../models/userModel";

export const getUserById = async (id: string) => {
  const user = await userModel.getUserById(id);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

export const createUser = async (data: {
  name: string;
  email: string;
  password: string;
  role: string;
}) => {
  const user = await userModel.createUser(data);
  return user;
};

export const updateUser = async (
  id: string,
  data: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  }
) => {
  const user = await userModel.updateUser(id, data);
  return user;
};

export const deleteUser = async (id: string) => {
  await userModel.deleteUser(id);
};
