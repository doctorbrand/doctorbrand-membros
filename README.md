# DoctorBrand · Área de membros

Área do cliente DoctorBrand (members.doctorbrand.co): o cliente vê o planejamento de conteúdo como um feed fiel do Instagram, aprova, pede alteração (por slide), escolhe a capa do Reels e agenda. O post aprovado e agendado publica sozinho no Instagram, em qualidade original.

Projeto separado do Painel de Tráfego. Nada daqui lê ou mexe em campanhas.

## O que tem

- **Clientes** (`/conteudo`, equipe): todos os clientes com pontuação do feed, alterações pedidas, aguardando, agendados e próxima publicação. Adicionar cliente novo.
- **Conteúdo** (`/cliente/<slug>/conteudo`): grid 3:4 do perfil, pontuação 0–100 contra as metas do plano (frequência, mix de formatos, pilares, legendas, CFM 2.336/2023, ritmo do grid), detalhe do post com carrossel, vídeo leve pelo Drive, seletor de capa, aprovar, pedir alteração, agendar e histórico.
- **Importação**: pacote .zip (uma pasta por post), pasta ou links do Google Drive ("qualquer pessoa com o link"), ou envio do computador.
- **Publicação**: Instagram Content Publishing API (foto, carrossel e Reels com capa). Rodada a cada 5 min em `/api/cron/publish`.
- **Acessos** (`/admin/usuarios`): login por cliente (só vê o próprio conteúdo) e da equipe.

## Variáveis de ambiente (Vercel)

| Variável | Para quê |
|---|---|
| `PANEL_PASSWORD` | Senha mestre da equipe. Também assina cookies e links de mídia. |
| `BLOB_READ_WRITE_TOKEN` | Criada ao conectar um Blob **privado** ao projeto. Guarda clientes, acessos, posts e mídias. |
| `META_ACCESS_TOKEN` | Token do System User com `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`. |
| `CRON_SECRET` | Chave do agendador de publicação. |
| `PUBLIC_BASE_URL` | `https://members.doctorbrand.co` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (opcional) | Aviso para a equipe quando o cliente aprova, pede alteração ou agenda. WhatsApp Cloud também funciona (ver `src/lib/alerts.ts`). |
| `GOOGLE_API_KEY` (opcional) | Lista pastas grandes do Drive pela API. Sem ela, usa a visualização pública da pasta. |

## Agendador (grátis)

O plano Hobby da Vercel só roda cron diário, então a publicação usa o cron-job.org:
`GET https://members.doctorbrand.co/api/cron/publish?key=<CRON_SECRET>` a cada 5 minutos.

## Rodar local

```bash
npm install
PANEL_PASSWORD=teste LOCAL_STORE_DIR=/tmp/membros npm run dev
```

`LOCAL_STORE_DIR` guarda tudo em disco no lugar do Blob. `META_GRAPH_URL` aponta a Graph API para um mock em testes.
