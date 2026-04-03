"use client";

import { useCallback, useRef, useState } from "react";
import type { PerfumeProduct } from "@/types/perfume";

const defaultSituation =
  "Après-midi dans une boutique parfumerie fine. La cliente hésite à tester un nouveau parfum oriental ; elle compare avec un bestseller qu'elle porte déjà.";

export function ObjectionLanding() {
  const [situation, setSituation] = useState(defaultSituation);
  const [perfumeJson, setPerfumeJson] = useState("");
  const [perfume, setPerfume] = useState<PerfumeProduct | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validateOk, setValidateOk] = useState(false);

  const [prebrief, setPrebrief] = useState<string | null>(null);
  const [realtimeInstructions, setRealtimeInstructions] = useState<
    string | null
  >(null);
  const [difficulty, setDifficulty] = useState("standard");

  const [busy, setBusy] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [realtimeSession, setRealtimeSession] = useState<unknown>(null);
  const [ephemeralTokenHint, setEphemeralTokenHint] = useState<string | null>(
    null
  );
  const [transcript, setTranscript] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const parsePerfumeLocal = useCallback(() => {
    setValidateError(null);
    setValidateOk(false);
    setPerfume(null);
    try {
      const parsed = JSON.parse(perfumeJson) as unknown;
      return parsed;
    } catch {
      setValidateError("JSON invalide (syntaxe).");
      return null;
    }
  }, [perfumeJson]);

  const validateRemote = useCallback(async () => {
    const parsed = parsePerfumeLocal();
    if (parsed === null) return;
    setBusy("validation");
    setApiError(null);
    try {
      const res = await fetch("/api/perfume/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        data?: PerfumeProduct;
        errors?: unknown;
      };
      if (!res.ok) {
        setValidateError(
          data.errors != null
            ? JSON.stringify(data.errors, null, 2)
            : "Validation refusée."
        );
        setValidateOk(false);
        return;
      }
      setValidateOk(true);
      setValidateError(null);
      if (data.data) setPerfume(data.data);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(null);
    }
  }, [parsePerfumeLocal]);

  const loadExample = useCallback(async () => {
    setApiError(null);
    try {
      const res = await fetch("/perfume-example.json");
      const text = await res.text();
      setPerfumeJson(text);
      setPrebrief(null);
      setRealtimeInstructions(null);
      setRealtimeSession(null);
      setEphemeralTokenHint(null);
      setValidateOk(false);
      setValidateError(null);
      setPerfume(null);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, []);

  const runPrebrief = useCallback(async () => {
    const parsed = parsePerfumeLocal();
    if (parsed === null) return;
    setBusy("prebrief");
    setApiError(null);
    setEphemeralTokenHint(null);
    setRealtimeSession(null);
    try {
      const res = await fetch("/api/prebrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation,
          perfume: parsed,
          difficulty,
        }),
      });
      const data = (await res.json()) as {
        prebrief?: string;
        realtimeInstructions?: string;
        error?: string;
      };
      if (!res.ok) {
        setApiError(data.error ?? "Prébrief impossible.");
        return;
      }
      setPrebrief(data.prebrief ?? "");
      setRealtimeInstructions(data.realtimeInstructions ?? "");
      setValidateOk(true);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(null);
    }
  }, [difficulty, parsePerfumeLocal, situation]);

  const createRealtimeSession = useCallback(async () => {
    if (!realtimeInstructions?.trim()) {
      setApiError("Génère d’abord un prébrief pour obtenir les instructions Realtime.");
      return;
    }
    setBusy("realtime");
    setApiError(null);
    try {
      const res = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: realtimeInstructions }),
      });
      const data = (await res.json()) as {
        session?: unknown;
        ephemeralToken?: string;
        error?: string;
      };
      if (!res.ok) {
        setApiError(data.error ?? "Session Realtime impossible.");
        return;
      }
      setRealtimeSession(data.session ?? null);
      const tok = data.ephemeralToken;
      setEphemeralTokenHint(
        typeof tok === "string" && tok.length > 0
          ? `${tok.slice(0, 14)}… (${tok.length} car.)`
          : null
      );
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(null);
    }
  }, [realtimeInstructions]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setApiError(null);
    setTranscript(null);
    setBusy("transcribe");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "speech.webm");
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: fd,
          });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) {
            setApiError(data.error ?? "Transcription impossible.");
            return;
          }
          setTranscript(data.text ?? "");
        } catch (e) {
          setApiError(e instanceof Error ? e.message : "Erreur réseau");
        } finally {
          setBusy(null);
        }
      };
      mr.start();
      window.setTimeout(() => stopRecording(), 6000);
    } catch (e) {
      setApiError(
        e instanceof Error ? e.message : "Microphone ou enregistrement refusé."
      );
      setBusy(null);
    }
  }, [stopRecording]);

  const onFile = useCallback(async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setPerfumeJson(text);
    setPrebrief(null);
    setRealtimeInstructions(null);
    setRealtimeSession(null);
    setEphemeralTokenHint(null);
    setValidateOk(false);
    setValidateError(null);
    setPerfume(null);
  }, []);

  return (
    <div className="flex flex-col gap-10 w-full max-w-3xl mx-auto px-4 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
          5Whygame
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Réponse aux objections — cliente virtuelle
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Décris une situation, charge une fiche parfum (JSON), génère un prébrief
          puis ouvre une session Realtime. Le micro envoie l’audio à Whisper (Azure).
        </p>
      </header>

      <section className="space-y-3">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Situation (contexte)
        </label>
        <textarea
          className="w-full min-h-[120px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Fiche produit (JSON)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept="application/json,.json"
              className="text-xs text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-violet-100 file:px-2 file:py-1 file:text-xs file:font-medium dark:file:bg-violet-950 dark:file:text-violet-200"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={loadExample}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Charger l’exemple
            </button>
          </div>
        </div>
        <textarea
          className="w-full min-h-[220px] rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          spellCheck={false}
          value={perfumeJson}
          onChange={(e) => setPerfumeJson(e.target.value)}
          placeholder="Colle ou importe un JSON conforme au schéma."
        />
        {validateError && (
          <p className="text-sm text-red-600 dark:text-red-400">{validateError}</p>
        )}
        {validateOk && !validateError && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Fiche validée
            {perfume ? ` — ${perfume.marque} · ${perfume.nom_du_parfum}` : ""}.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={validateRemote}
            disabled={busy !== null}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Valider la fiche
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Prébrief (GPT-5.4 mini) + jeton WebRTC Realtime
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          « Créer session Realtime » appelle{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            /openai/v1/realtime/client_secrets
          </code>{" "}
          (déploiement type{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            gpt-realtime-1.5
          </code>
          ).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            Difficulté
            <select
              className="ml-2 rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="doux">doux</option>
              <option value="standard">standard</option>
              <option value="exigeant">exigeant</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runPrebrief}
            disabled={busy !== null}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy === "prebrief" ? "Génération…" : "Générer le prébrief"}
          </button>
          <button
            type="button"
            onClick={createRealtimeSession}
            disabled={busy !== null}
            className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950"
          >
            {busy === "realtime" ? "Session…" : "Obtenir jeton WebRTC"}
          </button>
        </div>
        {ephemeralTokenHint && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Jeton éphémère reçu : {ephemeralTokenHint}
          </p>
        )}
        {prebrief && (
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase text-zinc-500">Prébrief</h3>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {prebrief}
            </pre>
          </div>
        )}
        {realtimeInstructions && (
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase text-zinc-500">
              Instructions Realtime (cliente)
            </h3>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-dashed border-zinc-200 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              {realtimeInstructions}
            </pre>
          </div>
        )}
        {realtimeSession !== null && (
          <div className="space-y-1">
            <h3 className="text-xs font-medium uppercase text-zinc-500">
              Réponse session Realtime
            </h3>
            <pre className="max-h-48 overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {JSON.stringify(realtimeSession, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Micro → Whisper (~6 s)
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Enregistrement court envoyé à Azure Whisper. Adapte la durée dans le code si
          besoin.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startRecording}
            disabled={busy !== null}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy === "transcribe" ? "Enregistrement / envoi…" : "Parler (6 s)"}
          </button>
        </div>
        {transcript !== null && (
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            <span className="font-medium">Transcription :</span> {transcript}
          </p>
        )}
      </section>

      {apiError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {apiError}
        </p>
      )}
    </div>
  );
}
