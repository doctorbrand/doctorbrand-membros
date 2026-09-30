import { ActionForm } from "@/components/ActionForm";
import { ActionButton } from "@/components/content/ContentActions";
import { adiarNpsAction, responderNpsAction } from "@/app/cliente/[slug]/actions";

/** Pergunta de satisfação (0 a 10), a cada 90 dias. */
export function NpsCard({ slug, preview = false }: { slug: string; preview?: boolean }) {
  return (
    <section className="card p-5 nps">
      <p className="label">Sua opinião{preview ? " · prévia do que o cliente vê" : ""}</p>
      <h2 className="pj-h2 mt-1">De 0 a 10, quanto você recomendaria a DoctorBrand a um colega?</h2>
      <ActionForm action={responderNpsAction.bind(null, slug)} className="mt-3 flex flex-col gap-3">
        <div className="nps-scale" role="radiogroup" aria-label="Nota de 0 a 10">
          {Array.from({ length: 11 }, (_, i) => (
            <label key={i} className="nps-opt"><input type="radio" name="score" value={i} required /><span>{i}</span></label>
          ))}
        </div>
        <div className="nps-ends"><span>Nada provável</span><span>Muito provável</span></div>
        <textarea name="comentario" rows={2} placeholder="O que mais faria diferença para você? (opcional)" className="ct-input" />
        <div className="flex flex-wrap items-center gap-2">
          <button className="ct-btn ct-btn-dark">Enviar</button>
        </div>
      </ActionForm>
      {!preview && <div className="mt-1"><ActionButton action={adiarNpsAction.bind(null, slug)} label="Agora não" variant="ghost" /></div>}
    </section>
  );
}
