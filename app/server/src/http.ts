import type { Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HttpError(400, `Données invalides (${i.path.join('.') || 'requête'}) : ${i.message}`);
  }
  return r.data;
}

export const userId = (res: Response): number => res.locals.userId as number;

export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format AAAA-MM-JJ');
export const zId = z.coerce.number().int().positive();

export function todayOr(v: unknown): string {
  const r = zDate.safeParse(v);
  return r.success ? r.data : new Date().toISOString().slice(0, 10);
}
