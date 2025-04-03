export class ObjectNotFoundError extends Error {
  constructor(object: string) {
    super(`${object} not found.`);
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectsNotFoundError extends Error {
  constructor(objects: string) {
    super(`No ${objects} where found.`);
    this.name = "ObjectsNotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("User credentials are invalid.");
    this.name = "InvalidCredentialsError";
  }
}

export class ExistingProfileError extends Error {
  constructor() {
    super("This user already has a profile.");
    this.name = "ExistingProfileError";
  }
}
