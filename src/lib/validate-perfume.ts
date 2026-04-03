import Ajv from "ajv";
import addFormats from "ajv-formats";
import perfumeSchema from "@/schemas/perfume-product.schema.json";
import type { ErrorObject } from "ajv";
import type { PerfumeProduct } from "@/types/perfume";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile<PerfumeProduct>(perfumeSchema);

export type ValidatePerfumeResult =
  | { ok: true; data: PerfumeProduct }
  | { ok: false; errors: ErrorObject[] | null | undefined };

export function validatePerfumeProduct(
  data: unknown
): ValidatePerfumeResult {
  if (validate(data)) {
    return { ok: true, data: data as PerfumeProduct };
  }
  return { ok: false, errors: validate.errors };
}
