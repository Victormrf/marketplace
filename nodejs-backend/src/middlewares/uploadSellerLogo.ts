import { createMulterStorage } from "../config/multerConfig";

const uploadSellerLogo = createMulterStorage("vmarket/logos");

export default uploadSellerLogo;
