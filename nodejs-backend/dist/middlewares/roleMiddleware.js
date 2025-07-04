"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleMiddleware = roleMiddleware;
function roleMiddleware(...allowedRoles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !user.role) {
            res.status(401).json({ message: "Unauthorized." });
            return;
        }
        if (!allowedRoles.includes(user.role)) {
            res.status(403).json({ message: "Access denied. Insufficient role." });
            return;
        }
        next();
    };
}
