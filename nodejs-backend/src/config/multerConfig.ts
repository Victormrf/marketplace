import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import cloudinary from "./cloudinary";

export function createMulterStorage(folder: string) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => {
      return {
        folder,
        allowed_formats: ["jpg", "jpeg", "png"],
        public_id: `${Date.now()}-${file.originalname}`,
      };
    },
  });

  return multer({ storage });
}
