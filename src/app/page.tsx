import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { adminHome, clientHome } from "@/lib/home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "cliente") redirect(s.clientSlug ? clientHome(s.clientSlug) : "/login?erro=sem-cliente");
  redirect(adminHome());
}
