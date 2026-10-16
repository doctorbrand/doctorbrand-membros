import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";

/** Token de upload direto do navegador para o Blob (privado). Equipe envia mídia; cliente só a capa do Reels. */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const s = await getSession();
        const m = pathname.match(/^content-media\/([a-z0-9-]+)\//);
        if (!s || !m || !(await getClient(m[1])) || pathname.includes("..")) throw new Error("Caminho inválido.");
        // Cliente só envia capa do próprio Reels (frame escolhido ou imagem), em JPG.
        if (s.role === "cliente") {
          if (s.clientSlug !== m[1] || !pathname.startsWith(`content-media/${m[1]}/covers/`)) throw new Error("Sem permissão.");
          return { allowedContentTypes: ["image/jpeg"], maximumSizeInBytes: 15 * 1024 * 1024, addRandomSuffix: true };
        }
        return {
          allowedContentTypes: ["image/jpeg", "video/mp4"], // formatos que a API do Instagram publica
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
