import type { ProjectMaterial } from "./project";

/** Materiais já existentes no Drive de cada cliente (levantados em 30/09/2026). A equipe edita na tela Projeto. */
export const SEED_MATERIALS: Record<string, ProjectMaterial[]> = {
  "carlos-picasso": [
    { id: "car0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1Vt2wrBO9jtDdu8xCfvHgXha94MUQYzB4" },
    { id: "car1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1Tw0iI15O4FiY7AipXahyOaP4wsfO8egg" },
    { id: "car2", kind: "guidelines", title: "Guia da marca", url: "https://drive.google.com/file/d/1WowSLpVlOVkuHKpsqk5yxV2pTM8ALJTo/view" },
    { id: "car3", kind: "roteiro", title: "Roteiros de captação", url: "https://docs.google.com/document/d/19Z4LT1N8Y_mVminuluJZBEi0R9l7WYaAGJG4ZQNWOmk/edit" },
    { id: "car4", kind: "roteiro", title: "Direção de captação", url: "https://docs.google.com/document/d/14Bl9pFygao90fnXGZkix_GC--u91B0WQQnnMXrMRUMs/edit" },
  ],
  "viegas": [
    { id: "vie0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1RfcHyUBsLmhzyPqHFiYLcdfEEKqbU39h" },
    { id: "vie1", kind: "identidade", title: "Logo", url: "https://drive.google.com/file/d/1rV9SiCV_nUJrrqzHid0JBrad-aRrbCWj/view" },
    { id: "vie2", kind: "moodboard", title: "Moodboard", url: "https://drive.google.com/file/d/1k9ecSyXmBvzCK-j9x4ubAEYL1omUwvlB/view" },
    { id: "vie3", kind: "roteiro", title: "Roteiros de captação", url: "https://docs.google.com/document/d/1EGB-Dq56LF1yegS-xcNYGPh0qa5s1TP5GilTwlr6Ydk/edit" },
  ],
  "vivian-ferrari": [
    { id: "viv0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1NOHMbLDO8XMlvbj2f0DM_9wKS7DCh-9Y" },
    { id: "viv1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1u26Q7svGgIZVNCbTRBILx_sqqcZq3ry1" },
    { id: "viv2", kind: "guidelines", title: "Brand guidelines", url: "https://drive.google.com/file/d/16GMRN9sUD6-zFzCAzPccQthIPTwpC8GS/view" },
    { id: "viv3", kind: "roteiro", title: "Roteiros de captação", url: "https://docs.google.com/document/d/1-eg98Bs85gBSmsV32xPy1WlwnL8a0iPy_p72dM3RG5c/edit" },
  ],
  "flavio-pinheiro": [
    { id: "fla0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1UlU9vRE-Jo4uUs1HohfISs-xJrf_UinN" },
    { id: "fla1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1ayBLu3oW16uSa8uYPDj6NitnbVk2XwAE" },
    { id: "fla2", kind: "guidelines", title: "Guia da marca", url: "https://drive.google.com/file/d/1xbYwmwE6lOQ09Mlw_x9ionfthsgM63MS/view" },
    { id: "fla3", kind: "moodboard", title: "Moodboard", url: "https://drive.google.com/file/d/15FeMClf_nmDszYmUJh2oRyQo3kdF2Bae/view" },
    { id: "fla4", kind: "roteiro", title: "Manual de captação", url: "https://docs.google.com/document/d/1VgaLXzessChngLukHsBmCs_pNw8rkZ5zYipCE_G2ses/edit" },
    { id: "fla5", kind: "stories", title: "Cronograma de stories", url: "https://docs.google.com/document/d/1lcm-rgCtOl_gVS8jo5Z0GPGfjEkFkvZvBck4Pkt9fTM/edit" },
  ],
  "eric-reis": [
    { id: "eri0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/14KD8o1bFeYrdjKY0jvoUEKw4me8ZsZ_k" },
    { id: "eri1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/15oCs9jT2BszMte2-maR1ipiVfs2Klxpt" },
    { id: "eri2", kind: "moodboard", title: "Moodboard", url: "https://drive.google.com/file/d/1RQQjSSwGEeqbT5lcvRCk5jwwDOhQVTi5/view" },
    { id: "eri3", kind: "roteiro", title: "Roteiro de captação", url: "https://docs.google.com/document/d/1w0pKDuesvJzR9e4l7l8j0OIPl6hxeViwkUqgW8MZaHg/edit" },
  ],
  "erica-barros": [
    { id: "eri0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1rvNN9u9HqyE7pKZVhlCx0BkaFMESP93p" },
    { id: "eri1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1d9ZaR7tId4BIlxAbMchW0INEGQ8d0NMz" },
    { id: "eri2", kind: "guidelines", title: "Manual de marca", url: "https://drive.google.com/file/d/1g2Z8Tl2bMnLGDvcF4WsnhjT8vE3ea6Ff/view" },
    { id: "eri3", kind: "moodboard", title: "Moodboard", url: "https://drive.google.com/file/d/1X3SWHhUPNmubRZ0Uh4akvbo_zc94F04z/view" },
    { id: "eri4", kind: "roteiro", title: "Roteiro de captação", url: "https://docs.google.com/document/d/1y-soeLu1jfdQG-VH4nPkI3M1N78CCBHJJYQZbGedD8M/edit" },
  ],
  "danilo-tacinari": [
    { id: "dan0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1WgY4SpUYe19fk19dBGrCJfCJ0VRtNloL" },
    { id: "dan1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1uhIjpvQ44opWerpTCusZhaVfBJFOGCwP" },
    { id: "dan2", kind: "guidelines", title: "Playbook de posicionamento", url: "https://drive.google.com/file/d/1YsCGA8EWGaK4wCWfBfhMU7OadgcisybI/view" },
    { id: "dan3", kind: "moodboard", title: "Moodboard", url: "https://drive.google.com/file/d/1U9lDgjG0E6HKMIbLoc8REboIry-b42fV/view" },
    { id: "dan4", kind: "roteiro", title: "Roteiros de captação", url: "https://docs.google.com/document/d/1SQ3MFjli69qVQ9DiSIJ8cEGT7uDLU5ebeosTku3EJhg/edit" },
  ],
  "jose-mauro": [
    { id: "jos0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1oGyG-3xzuAJ9IEIDbwWepQ6c-v1J02hV" },
    { id: "jos1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1I7-FFOPfi4deSiwtfPq1PrOnmD5wdSEN" },
    { id: "jos2", kind: "guidelines", title: "Guia da marca", url: "https://drive.google.com/file/d/1nPOC7aP1puY3vBXsxfGCVYJfdLy-ZKI4/view" },
    { id: "jos3", kind: "moodboard", title: "Moodboard", url: "https://drive.google.com/file/d/1Wi9rZUFxo7ltt-wxLyjkPxTUe9PS5dKD/view" },
    { id: "jos4", kind: "roteiro", title: "Roteiros de captação", url: "https://docs.google.com/document/d/1sSdujez4bZnO4mctTv_Pabvfcu76iRFHywxClgE9M6w/edit" },
    { id: "jos5", kind: "stories", title: "Frases para stories", url: "https://docs.google.com/spreadsheets/d/1KX_HKpfO7O_HEl81jofCOPmX3_KtjDZl6IaOqUnE6zU/edit" },
  ],
  "glaciale": [
    { id: "gla0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1DVoGvDfAFGX7EBP8yVAcgqsoZHzwvfEh" },
    { id: "gla1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1wF9cs7nFhc8bW7z-5cMRfyBzQ02ad3hh" },
  ],
  "brunno-bernardo": [
    { id: "bru0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/12ppgIuxDqLfmOv7txna1O63Rvbl8dytj" },
    { id: "bru1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/13Xm_oG05wVseOtRW9qsW_YeJzfsTOZcX" },
    { id: "bru2", kind: "guidelines", title: "Guia oficial de roteiros", url: "https://docs.google.com/document/d/142bgHVgcF6a1tm29knsGGVhxgLonKsLgjSOOkN--Lf4/edit" },
    { id: "bru3", kind: "planejamento", title: "Sistema editorial", url: "https://docs.google.com/document/d/1h-AQ9Ai10CnIbvh3iHTZbqHi1j1gD_PX66BqTTuJm5c/edit" },
    { id: "bru4", kind: "roteiro", title: "Roteiros da captação 27/08", url: "https://docs.google.com/document/d/1rVQ7eQc5YL6p5wy6ZEf_XROAvMv0qYx3aVcOXqyNZdI/edit" },
    { id: "bru5", kind: "documento", title: "Carrosséis", url: "https://docs.google.com/document/d/1ToU8s66LWQvE50VaEAb-ON94iy40eKjBxGssz-eRqtQ/edit" },
    { id: "bru6", kind: "documento", title: "Audiovisual", url: "https://drive.google.com/drive/folders/1te7KJh0bTvw3cztXdwcGnL5v0SGlMhsN" },
  ],
  "fernando-fontes": [
    { id: "fer0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1bEK_qxCTf3kkU9gBluuMAYC_ESJmw3lT" },
    { id: "fer1", kind: "guidelines", title: "Dossiê narrativo", url: "https://docs.google.com/document/d/1dteeCpcPnKOhgE3_76qWvhIs6SKAk-VVxHOHTLsJLHQ/edit" },
    { id: "fer2", kind: "documento", title: "Audiovisual", url: "https://drive.google.com/drive/folders/1PerE1eQNbVShuqll3ONKD_3HiabDVgR_" },
    { id: "fer3", kind: "documento", title: "Social media", url: "https://drive.google.com/drive/folders/1frDjEJoYrJ4-hHgiIUv1aXlxKHO5rZ7H" },
  ],
  "cecilia-favre": [
    { id: "cec0", kind: "documento", title: "Pasta do projeto", url: "https://drive.google.com/drive/folders/1JnYtAJggTSVkPl5sRmPk7_2eETOWMgMe" },
    { id: "cec1", kind: "identidade", title: "Identidade visual", url: "https://drive.google.com/drive/folders/1YwEsBxdhTAYa61EChR6AR_i8WEQGmDNp" },
    { id: "cec2", kind: "moodboard", title: "Moodboard e roteiros de captação", url: "https://drive.google.com/file/d/1uRjPuzIor9sbA-YtsQ5wxJNn9p1amptU/view" },
    { id: "cec3", kind: "roteiro", title: "Roteiros da captação 19/06", url: "https://docs.google.com/document/d/1eLnl3_UDtZKY_kRSkGHypOaGWNJtLcrEhcqSj-ehJos/edit" },
    { id: "cec4", kind: "planejamento", title: "Ideias de post orgânico", url: "https://docs.google.com/document/d/1nnMGs_mIfLG1fpgwR9IWzn2BQR-4pvTaCOO6HXZXqfM/edit" },
    { id: "cec5", kind: "documento", title: "Audiovisual", url: "https://drive.google.com/drive/folders/1n1FBSqJEVWfWhcLBgXycR1LwovxFmEVV" },
    { id: "cec6", kind: "documento", title: "Social media", url: "https://drive.google.com/drive/folders/1-PfnChx1F67klBMxmUvjhCZMs8g2EDZE" },
  ],
};
