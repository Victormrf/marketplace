import { createMulterStorage } from "../config/multerConfig";

const uploadProductImage = createMulterStorage("vmarket/products");

export default uploadProductImage;
