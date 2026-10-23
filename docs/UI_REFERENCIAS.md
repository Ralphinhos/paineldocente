# Referências e organização da interface

A composição segue as duas imagens aprovadas em 19/10/2026: **Imagem do ChatGPT 19 de out. de 2026, 14_11_49-1.png** (acessos) e **14_11_50-2.png** (entregas). O HTML **Análise Docente - Acessos e Atrasos(3).html** orienta os Top 10, com as regras atuais de dados.

## Estrutura

O NED usa quatro abas: **Acessos**, **Entregas**, **Prazos** e **Relatório por coordenador**. A última prepara o relatório dentro da mesma área de trabalho. A Alta Gestão possui um panorama próprio por semestre, com a mesma identidade visual e acesso ao detalhamento em leitura. O destinatário e seus cursos são definidos no servidor; os filtros analíticos ficam ocultos nessa aba.

O cabeçalho une NED UNIFENAS, Monitoramento Docente, data da coleta e ações. Quatro cartões suaves mostram total, regularidade, atenção/prazo em aberto e críticos/vencidas. Ícones circulares e formas discretas no fundo seguem os modelos. Cores e textos identificam os estados; percentuais informam a proporção sobre o total do recorte.

- **Acessos:** rosca por situação, barras horizontais dos dez maiores intervalos, tabela de problemas e prioridades laterais. O acesso é ao ambiente Moodle, com um registro por docente. Faixas 0–7 / 8–14 / 15+. Sem registro, dado desconhecido e zero dias são distintos.
- **Entregas:** rosca por situação, barras empilhadas por docente com prioridade às pendências, tabela com bimestre, prazo, atraso e origem; Top 10 de atividades e regras ao lado. As cores separam antecipadas, no prazo/replicadas, resolvidas com atraso, pendentes no prazo, vencidas e a validar.
- **Comparações:** acessos mais recentes e entregas no prazo ficam em uma área expansível. As barras positivas usam base exigível confirmada; não geram nota ponderada.

Os dados completos do recorte alimentam os gráficos, independentemente da página da tabela. O percentual de pendências usa itens já exigíveis em dias civis e com situação/responsável confirmados. Itens futuros, dispensas e dados a validar não entram nessa base. A legenda verde da rosca de entregas consulta somente no prazo/replicadas; antecipadas continuam separadas. O clique de atividade restringe a tabela pelo item e modalidade.

A aparência dos modelos foi preservada, sem copiar inconsistências dos exemplos: o acesso continua global, a data da coleta é verdadeira, situações resolvidas não aparecem como pendências críticas e totais vêm do serviço. O período seleciona o período letivo disponível; não há filtro semanal fictício. UA/vídeos mantêm datas, versões e registro manual.

## Componentes e dimensões

- `AppShell` / `DashboardPage`: cabeçalho único e três áreas do NED.
- `MonitoringMetrics`, `DistributionChart`, `MonitoringChart` e `TeacherDeliveryChart`: cartões, roscas e barras SVG locais.
- `TeacherPicker`: busca de nomes e seleção por ID, com opções e navegação por teclado.
- `src/styles/monitoring.css`: tema dos modelos, sem CDN ou nova biblioteca de gráficos.

Largura máxima de 1600px, intervalos de 12–16px e superfícies com raio de 8–9px. Até 1250px, tabela e prioridades passam para linhas distintas. Até 1050px, cartões/filtros ficam em duas colunas e gráficos em uma. Até 650px, filtros ficam em uma coluna e as legendas da rosca abaixo do desenho; tabelas e barras preservam a leitura com rolagem. Até 370px, cartões ficam em uma coluna. Abas, busca, legendas e gráficos mantêm foco, teclado e rótulos acessíveis.

## Skiper UI — Skiper40 / CssLink

Referência: https://skiper-ui.com/v1/skiper40

Registro consultado: https://skiper-ui.com/r/skiper40.json

Autor creditado pelo projeto: Gurvinder Singh / 02gxuri.

O efeito de sublinhado do link foi adaptado em UnderlinedLink e no CSS, com âncora HTML nativa. Foi removida a dependência de Next.js. A versão gratuita do componente informa exigência de atribuição; o rodapé do aplicativo credita Skiper UI.

O comando npx shadcn add @skiper-ui/skiper40 não foi executado: a adaptação atende ao projeto React/Vite existente sem instalar Motion ou converter toda a interface para shadcn/Tailwind.

## Cult UI — direction-aware tabs

Referência: https://github.com/nolly-studio/cult-ui

Arquivo de referência: apps/www/registry/default/ui/direction-aware-tabs.tsx

Versão consultada: 67a66c6ac1cd240914ba688a907611b3437a7a2b.

A organização em abas e a seleção visual inspiraram WorkspaceTabs. A implementação usa botões nativos, estados React e CSS, com navegação por teclado e controles/painéis ARIA. Efeitos de blur e molas não foram incorporados.

Licença original preservada:

> MIT License
>
> Copyright (c) 2023 Jordan-Gilliam
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Limites e teste local

`npm run demo` abre a demonstração em localhost:8080. Clique em Abrir demonstração do NED. Dados e destinatários são fictícios; alterações ficam em memória e não há envio externo.

A renderização dos componentes em Node verifica conteúdo e números com dados do serviço. Não verifica aparência, foco ou cliques em navegador. A verificação visual em Chrome/Edge continua pendente: o navegador remoto bloqueou localhost e arquivos locais por política.

A integração real exige SQL somente leitura, TLS, prazos oficiais e destinatários homologados. A prévia e os downloads usam HTML/texto. Cadastro de destinatários na interface, XLSX por coordenação e exceções manuais para atividades Moodle ficam fora desta alteração.
