export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
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
