"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const multerConfig_1 = require("../config/multerConfig");
const uploadSellerLogo = (0, multerConfig_1.createMulterStorage)("vmarket/logos");
exports.default = uploadSellerLogo;
