import { redirect } from "next/navigation";

export default async function ClientePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/cliente/${slug}/conteudo`);
}
