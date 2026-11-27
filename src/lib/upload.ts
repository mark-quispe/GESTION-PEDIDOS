/**
 * RNF-08: subida reanudable directo del navegador a Drive, por partes de 8 MB.
 * Si una parte falla, pregunta a Google cuánto recibió y sigue desde ahí.
 */
const CHUNK = 8 * 1024 * 1024; // múltiplo de 256 KB, como pide Google

export type UploadedFile = { id: string; name: string };

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function nextOffset(res: Response, fallback: number) {
  const range = res.headers.get("Range");
  const m = range ? /bytes=0-(\d+)/.exec(range) : null;
  return m ? Number(m[1]) + 1 : fallback;
}

export async function uploadToDrive(url: string, file: File, onProgress?: (fraction: number) => void): Promise<UploadedFile> {
  let offset = 0;
  let failures = 0;
  while (true) {
    const end = Math.min(offset + CHUNK, file.size);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Range": `bytes ${offset}-${end - 1}/${file.size}` },
        body: file.slice(offset, end),
      });
    } catch {
      res = new Response(null, { status: 599 });
    }
    if (res.ok) {
      onProgress?.(1);
      return (await res.json()) as UploadedFile;
    }
    if (res.status === 308) {
      offset = nextOffset(res, end);
      failures = 0;
      onProgress?.(offset / file.size);
      continue;
    }
    if (res.status === 404 || res.status === 410) throw new Error("La subida caducó. Vuelve a intentarlo.");
    if (++failures > 4) throw new Error("No se pudo subir el archivo. Revisa tu conexión e inténtalo otra vez.");
    await sleep(1000 * 2 ** failures);
    // Pregunta cuánto llegó antes de reintentar.
    try {
      const status = await fetch(url, { method: "PUT", headers: { "Content-Range": `bytes */${file.size}` } });
      if (status.ok) return (await status.json()) as UploadedFile;
      if (status.status === 308) offset = nextOffset(status, 0);
    } catch {
      /* se reintenta desde el mismo punto */
    }
  }
}
