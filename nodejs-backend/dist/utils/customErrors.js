"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExistingProfileError = exports.InvalidCredentialsError = exports.ConflictError = exports.ValidationError = exports.ObjectsNotFoundError = exports.ObjectNotFoundError = void 0;
class ObjectNotFoundError extends Error {
    constructor(object) {
        super(`${object} not found.`);
        this.name = "ObjectNotFoundError";
    }
}
exports.ObjectNotFoundError = ObjectNotFoundError;
class ObjectsNotFoundError extends Error {
    constructor(objects) {
        super(`No ${objects} where found.`);
        this.name = "ObjectsNotFoundError";
    }
}
exports.ObjectsNotFoundError = ObjectsNotFoundError;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConflictError";
    }
}
exports.ConflictError = ConflictError;
class InvalidCredentialsError extends Error {
    constructor() {
        super("User credentials are invalid.");
        this.name = "InvalidCredentialsError";
    }
}
exports.InvalidCredentialsError = InvalidCredentialsError;
class ExistingProfileError extends Error {
    constructor() {
        super("This user already has a profile.");
        this.name = "ExistingProfileError";
    }
}
exports.ExistingProfileError = ExistingProfileError;
