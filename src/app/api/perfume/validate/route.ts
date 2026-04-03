import { validatePerfumeProduct } from "@/lib/validate-perfume";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { valid: false, error: "Corps JSON invalide." },
      { status: 400 }
    );
  }

  const result = validatePerfumeProduct(body);
  if (result.ok) {
    return Response.json({ valid: true, data: result.data });
  }

  return Response.json(
    {
      valid: false,
      errors: result.errors ?? [],
    },
    { status: 400 }
  );
}
