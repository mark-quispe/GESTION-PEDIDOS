"use client";

import { useState, useTransition } from "react";
import { getPickerConfig } from "@/actions/drive";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";

/* Tipos mínimos del Google Picker (se carga desde apis.google.com). */
type PickerDoc = { id: string; name: string; mimeType: string };
type PickerData = { action: string; docs?: PickerDoc[] };
type PickerBuilder = {
  addView(v: unknown): PickerBuilder;
  setOAuthToken(t: string): PickerBuilder;
  setDeveloperKey(k: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(t: string): PickerBuilder;
  setLocale(l: string): PickerBuilder;
  setCallback(cb: (d: PickerData) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
};
type DocsView = {
  setIncludeFolders(v: boolean): DocsView;
  setSelectFolderEnabled(v: boolean): DocsView;
  setMimeTypes(m: string): DocsView;
  setMode(m: unknown): DocsView;
};
type GooglePicker = {
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: unknown) => DocsView;
    ViewId: { FOLDERS: unknown; SPREADSHEETS: unknown };
    DocsViewMode: { LIST: unknown };
    Action: { PICKED: string };
  };
};
declare global {
  interface Window {
    gapi?: { load(name: string, cb: () => void): void };
    google?: GooglePicker;
  }
}

let loading: Promise<void> | null = null;
function loadPicker() {
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = () => window.gapi!.load("picker", () => resolve());
    s.onerror = () => {
      loading = null;
      reject(new Error("No se pudo cargar el selector de Google."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * RF-22, RF-28 y RF-34: el Google Picker. Elegir un archivo o carpeta con él
 * es lo que le da a la app permiso sobre ese elemento (drive.file).
 */
export function GooglePickerButton({
  kind,
  label,
  title,
  onPicked,
  variant = "default",
}: {
  kind: "folder" | "spreadsheet";
  label: string;
  title: string;
  onPicked: (doc: PickerDoc) => void;
  variant?: "default" | "outline";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () =>
    startTransition(async () => {
      setError(null);
      const cfg = await getPickerConfig();
      if (!cfg.ok) return setError(cfg.error);
      try {
        await loadPicker();
      } catch (e) {
        return setError(e instanceof Error ? e.message : "Error");
      }
      const g = window.google!.picker;
      const view =
        kind === "folder"
          ? new g.DocsView(g.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder").setMode(g.DocsViewMode.LIST)
          : new g.DocsView(g.ViewId.SPREADSHEETS).setMode(g.DocsViewMode.LIST);
      new g.PickerBuilder()
        .addView(view)
        .setOAuthToken(cfg.data!.accessToken)
        .setDeveloperKey(cfg.data!.apiKey)
        .setAppId(cfg.data!.appId)
        .setLocale("es")
        .setTitle(title)
        .setCallback((data) => {
          if (data.action === g.Action.PICKED && data.docs?.[0]) onPicked(data.docs[0]);
        })
        .build()
        .setVisible(true);
    });

  return (
    <div className="grid gap-2">
      <Button type="button" variant={variant} className="justify-self-start" disabled={pending} onClick={open}>
        {pending ? "Abriendo…" : label}
      </Button>
      <FormError message={error} />
    </div>
  );
}
