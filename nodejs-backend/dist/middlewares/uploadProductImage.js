"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const multerConfig_1 = require("../config/multerConfig");
const uploadProductImage = (0, multerConfig_1.createMulterStorage)("vmarket/products");
exports.default = uploadProductImage;
