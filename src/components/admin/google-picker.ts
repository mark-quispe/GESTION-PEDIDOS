"use client";

import { getPickerConfig } from "@/actions/drive";

/* Tipos mínimos del Google Picker (se carga desde apis.google.com). */
export type PickerDoc = { id: string; name: string; mimeType: string };
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
    Action: { PICKED: string; CANCEL: string };
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
 * RF-22, RF-28 y RF-34: abre el Google Picker. Elegir un archivo o una carpeta con él
 * es lo que le da a la app permiso sobre ese elemento (drive.file). Devuelve null si se cierra.
 */
export async function openPicker(kind: "folder" | "spreadsheet", title: string): Promise<PickerDoc | null> {
  const cfg = await getPickerConfig();
  if (!cfg.ok) throw new Error(cfg.error);
  await loadPicker();
  const g = window.google!.picker;
  const view =
    kind === "folder"
      ? new g.DocsView(g.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder").setMode(g.DocsViewMode.LIST)
      : new g.DocsView(g.ViewId.SPREADSHEETS).setMode(g.DocsViewMode.LIST);
  return new Promise((resolve) => {
    new g.PickerBuilder()
      .addView(view)
      .setOAuthToken(cfg.data!.accessToken)
      .setDeveloperKey(cfg.data!.apiKey)
      .setAppId(cfg.data!.appId)
      .setLocale("es")
      .setTitle(title)
      .setCallback((data) => {
        if (data.action === g.Action.PICKED) resolve(data.docs?.[0] ?? null);
        else if (data.action === g.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
