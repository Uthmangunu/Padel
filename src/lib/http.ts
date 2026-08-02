import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      { error: "Invalid request", issues: error.issues },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Unexpected server error" }, { status: 500 });
}
