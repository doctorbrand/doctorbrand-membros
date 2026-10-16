/**
 * CSS dos 5 modelos DoctorBrand, copiado do assets/template.html da skill carrossel-fernandofontees
 * (só sem os @font-face: as fontes vêm do kit de marca). Para mudar o desenho, troque aqui e em
 * doctorbrand.ts, e mantenha a skill igual.
 */
export const DOCTORBRAND_CSS = `/* Design system DoctorBrand. Valores de cor vêm do doctorbrand.co; não alterar. */
:root {
  --brown-deep: #0c0a08; --brown: #161210; --brown-light: #2a2218; --brown-medium: #3a3028;
  --cream: #d8d3c7; --cream-light: #e6e1d5; --cream-dark: #a89e8e; --sand: #9a8e76;
  --gold: #c9a96e; --gold-light: #e0c98a;
  --text-80: rgba(216,211,199,.8); --text-60: rgba(216,211,199,.6);
  --line: rgba(216,211,199,.1); --line-strong: rgba(216,211,199,.25); --gold-line: rgba(201,169,110,.4);
  --serif: Denton, Georgia, serif; --sans: "Aktiv Grotesk", Inter, "Helvetica Neue", Arial, sans-serif; --script: Sloop, cursive;
  --m: 96px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #333; font-family: var(--sans); -webkit-font-smoothing: antialiased; }
.slide { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: var(--brown-deep); color: var(--cream); margin: 0 0 40px; }
.slide.claro { background: var(--cream-light); color: var(--brown-deep); }
.z { position: relative; z-index: 2; }
.abs { position: absolute; z-index: 2; }
.ph { position: absolute; inset: 0; background-size: cover; background-position: center; z-index: 0; }
.ph.pb { filter: grayscale(1) contrast(1.06); }
.veu { position: absolute; inset: 0; z-index: 1; }
.d { color: var(--gold); }
em { font-style: italic; }

/* ============ 1. AUTORIDADE (só texto, Denton) ============ */
.m-autoridade .top { position: absolute; top: 72px; left: 0; right: 0; text-align: center; font-size: 20px; letter-spacing: .3em; text-transform: uppercase; color: var(--text-60); }
.m-autoridade .claro .top, .m-autoridade .claro .bottom { color: var(--brown-medium); }
.m-autoridade .bottom { position: absolute; bottom: 64px; left: var(--m); right: var(--m); display: flex; justify-content: space-between; font-size: 22px; color: var(--text-60); }
.m-autoridade .body { position: absolute; left: var(--m); right: var(--m); top: 200px; bottom: 200px; display: flex; flex-direction: column; justify-content: center; }
.m-autoridade .eyebrow { font-size: 22px; letter-spacing: .25em; text-transform: uppercase; color: var(--gold); margin-bottom: 40px; }
.m-autoridade h1, .m-autoridade h2 { font-family: var(--serif); font-weight: 400; }
.m-autoridade h1 { font-size: 112px; line-height: 1.04; letter-spacing: -.01em; }
.m-autoridade h2 { font-size: 80px; line-height: 1.08; }
.m-autoridade em { color: var(--text-60); }
.m-autoridade p.t { font-size: 36px; line-height: 1.5; color: var(--text-80); margin-top: 48px; max-width: 820px; }
.m-autoridade .t-capa p.t { font-size: 38px; color: var(--cream); margin-top: 56px; }
.m-autoridade .num { font-family: var(--serif); font-size: 280px; line-height: .9; color: var(--gold); letter-spacing: -.02em; }
.m-autoridade .num-legenda { font-family: var(--serif); font-size: 56px; line-height: 1.15; margin-top: 40px; }
.m-autoridade blockquote { font-family: var(--serif); font-style: italic; font-size: 76px; line-height: 1.18; color: var(--brown-deep); }
.m-autoridade .assina { margin-top: 56px; font-size: 22px; letter-spacing: .25em; text-transform: uppercase; color: var(--brown-medium); }
.m-autoridade ol { list-style: none; margin-top: 56px; border-top: 1px solid var(--line); }
.m-autoridade ol li { display: flex; gap: 32px; align-items: baseline; padding: 26px 0; border-bottom: 1px solid var(--line); font-size: 36px; line-height: 1.35; }
.m-autoridade ol li span { font-family: var(--serif); font-size: 40px; color: var(--gold); min-width: 40px; }
.m-autoridade .kw { align-self: flex-start; margin-top: 56px; padding: 26px 56px; border-radius: 9999px; background: var(--gold-light); color: var(--brown-deep); font-size: 30px; letter-spacing: .18em; text-transform: uppercase; }

/* ============ 2. EDITORIAL (ref. Gládia Bernardi) ============ */
.m-editorial .hdr { position: absolute; z-index: 3; top: 64px; left: 80px; right: 80px; display: flex; justify-content: space-between; font-size: 21px; letter-spacing: .2em; text-transform: uppercase; color: var(--text-80); }
.m-editorial .hdr b { font-weight: 600; } .m-editorial .hdr i { font-style: normal; font-weight: 300; color: var(--text-60); margin-left: 14px; }
.m-editorial .claro .hdr { color: var(--brown-medium); } .m-editorial .claro .hdr i { color: var(--brown-medium); }
.m-editorial .script { font-family: var(--script); font-size: 132px; white-space: nowrap; line-height: 1; margin-bottom: 18px; color: var(--gold); }
.m-editorial .caps { font-family: var(--sans); font-weight: 500; text-transform: uppercase; font-size: 82px; line-height: 1.02; color: var(--cream-light); letter-spacing: .005em; }
.m-editorial .sub { font-size: 36px; color: var(--text-80); margin-top: 22px; font-weight: 300; }
.m-editorial .bloco { font-size: 40px; line-height: 1.3; color: var(--cream-light); font-weight: 400; max-width: 560px; }
.m-editorial .bloco b { font-weight: 600; color: var(--gold-light); }
.m-editorial .gnum { font-family: var(--sans); font-weight: 300; text-transform: uppercase; color: var(--gold); line-height: .86; letter-spacing: -.02em; }
.m-editorial .lbl { font-weight: 600; text-transform: uppercase; font-size: 40px; line-height: 1.05; color: var(--brown-deep); }
.m-editorial .claro p { font-size: 36px; line-height: 1.35; color: var(--brown-medium); }
.m-editorial .claro p b { color: #6e5320; font-weight: 600; }
.m-editorial .serif-it { font-family: var(--serif); font-style: italic; font-weight: 400; text-transform: none; color: var(--gold); font-size: 108px; line-height: 1; }

/* ============ 3. MANCHETE (ref. Academia Lendária) ============ */
.m-manchete .hdr { position: absolute; z-index: 3; top: 56px; left: 72px; right: 72px; display: flex; justify-content: space-between; font-size: 19px; color: var(--text-60); }
.m-manchete .kicker { font-size: 20px; letter-spacing: .22em; text-transform: uppercase; color: var(--text-60); margin-bottom: 26px; }
.m-manchete .kicker::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 9999px; background: var(--gold); margin-right: 16px; vertical-align: middle; }
.m-manchete .h-sans { font-family: var(--sans); font-weight: 400; font-size: 118px; line-height: .98; letter-spacing: -.035em; color: var(--cream-light); }
.m-manchete .h-serif { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 118px; line-height: 1.02; color: var(--gold); letter-spacing: -.01em; }
.m-manchete .h2-sans { font-family: var(--sans); font-weight: 400; font-size: 76px; line-height: 1; letter-spacing: -.03em; color: var(--cream-light); }
.m-manchete .h2-serif { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 76px; color: var(--gold); }
.m-manchete .sub { font-size: 32px; color: var(--text-60); margin-top: 34px; }
.m-manchete .seta { position: absolute; z-index: 3; right: 72px; bottom: 72px; width: 96px; height: 56px; border-radius: 9999px; background: var(--gold-light); color: var(--brown-deep); display: grid; place-items: center; font-size: 30px; }
.m-manchete .pg { position: absolute; z-index: 3; left: 72px; bottom: 84px; font-size: 20px; letter-spacing: .2em; color: var(--text-60); }
.m-manchete .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 52px; }
.m-manchete .card { border: 1px solid var(--line-strong); border-radius: 4px; padding: 30px 30px 36px; background: rgba(22,18,16,.85); }
.m-manchete .card .ct { font-size: 18px; letter-spacing: .2em; text-transform: uppercase; color: var(--text-60); border-bottom: 1px solid var(--line); padding-bottom: 18px; margin-bottom: 22px; }
.m-manchete .card .cv { font-size: 38px; line-height: 1.05; color: var(--cream-light); letter-spacing: -.02em; }
.m-manchete .card .cd { font-size: 26px; line-height: 1.4; color: var(--text-60); margin-top: 22px; }
.m-manchete .card.on { border-color: var(--gold-line); }
.m-manchete .card.on .cv { color: var(--gold-light); }

/* ============ 4. CONSULTORIA (ref. RR Brands) ============ */
.m-consultoria .selo { position: absolute; z-index: 3; top: 72px; left: 80px; width: 64px; }
.m-consultoria .rod { position: absolute; z-index: 3; left: 80px; right: 80px; bottom: 64px; border-top: 1px solid var(--line-strong); padding-top: 22px; display: flex; justify-content: space-between; font-size: 19px; letter-spacing: .14em; text-transform: uppercase; color: var(--text-80); }
.m-consultoria .rod b { font-weight: 600; }
.m-consultoria .rod span { color: var(--text-60); letter-spacing: .1em; }
.m-consultoria .arrow { position: absolute; z-index: 3; right: 80px; bottom: 112px; width: 54px; height: 54px; }
.m-consultoria .tc { font-family: var(--sans); font-weight: 300; text-transform: uppercase; font-size: 80px; line-height: .96; letter-spacing: -.01em; color: var(--cream-light); }
.m-consultoria .tc em { font-family: var(--serif); font-style: italic; font-weight: 500; letter-spacing: -.02em; color: var(--cream-light); }
.m-consultoria .tc em.d { color: var(--gold); }
.m-consultoria .secao { position: absolute; z-index: 3; top: 72px; left: 80px; right: 80px; display: flex; align-items: center; gap: 28px; font-size: 20px; letter-spacing: .22em; text-transform: uppercase; color: var(--text-60); }
.m-consultoria .secao::after { content: ""; flex: 1; height: 1px; background: var(--line-strong); }
.m-consultoria .grande { font-family: var(--sans); font-weight: 300; font-size: 64px; line-height: 1.12; letter-spacing: -.02em; color: var(--text-60); }
.m-consultoria .grande b { font-weight: 400; color: var(--cream-light); }
.m-consultoria .etapas { list-style: none; border-top: 1px solid var(--line-strong); }
.m-consultoria .etapas li { display: grid; grid-template-columns: 120px 1fr; padding: 34px 0; border-bottom: 1px solid var(--line-strong); }
.m-consultoria .etapas .n { font-family: var(--serif); font-style: italic; font-size: 48px; color: var(--gold); }
.m-consultoria .etapas .et { font-size: 40px; color: var(--cream-light); letter-spacing: -.01em; }
.m-consultoria .etapas .ed { font-size: 26px; color: var(--text-60); margin-top: 8px; }

/* ============ 5. BASTIDOR (ref. Lucas Miyamoto) ============ */
.m-bastidor .marca { position: absolute; z-index: 3; top: 76px; left: 50%; transform: translateX(-50%); width: 58px; }
.m-bastidor .pg { position: absolute; z-index: 3; right: 72px; bottom: 64px; font-size: 20px; color: var(--text-60); letter-spacing: .1em; }
.m-bastidor .big { font-family: var(--sans); font-weight: 400; font-size: 104px; line-height: 1.02; letter-spacing: -.04em; color: #f4f0e8; }
.m-bastidor .mid { font-family: var(--sans); font-weight: 400; font-size: 60px; line-height: 1.08; letter-spacing: -.03em; color: #f4f0e8; }
.m-bastidor .mid b { font-weight: 700; }
.m-bastidor .peq { font-size: 28px; line-height: 1.4; color: var(--text-80); margin-top: 28px; max-width: 640px; }
.m-bastidor .telas { display: flex; flex-direction: column; gap: 14px; }
.m-bastidor .tela { background: rgba(230,225,213,.95); color: var(--brown-deep); border-radius: 4px; padding: 24px 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: none; }
.m-bastidor .tela b { font-size: 30px; font-weight: 500; letter-spacing: -.01em; }
.m-bastidor .tela span { font-size: 20px; letter-spacing: .14em; text-transform: uppercase; color: var(--brown-medium); }
`;
