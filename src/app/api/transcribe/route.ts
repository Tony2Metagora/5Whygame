import { azureTranscribeFormData } from "@/lib/azure";

export const maxDuration = 120;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "FormData attendu." }, { status: 400 });
  }

  try {
    const { text } = await azureTranscribeFormData(formData);
    return Response.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return Response.json({ error: message }, { status: 502 });
  }
}
