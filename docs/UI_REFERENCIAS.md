# Referências e organização da interface

**Análise Docente - Acessos e Atrasos(3).html** define a identidade visual: fundo slate-50, cabeçalho branco, quatro cartões coloridos, títulos de filtro em maiúsculas, gráficos de colunas com eixos e valores e tabela branca. O fluxo mantém as duas abas do NED.

## Estrutura

Somente duas abas principais: **Acessos ao ambiente** e **Entregas**. Um filtro global de docente afeta ambas. Quatro cartões por aba apresentam total, situação regular, pendências críticas/vencidas e atenção/prazo em aberto. Entregas concluídas com atraso ficam entre as resolvidas. As listas abrem com problemas; Ver todos permite conferir os regulares.

Dois painéis de gráficos por aba, como a grade de duas colunas do HTML:

- Acessos: panorama de todos os docentes, ordenado por dias sem acessar; contagem por faixa de acesso.
- Entregas: até dez docentes com pendências, ordenados pelo maior atraso, com quantidade de itens e maior atraso em dias; contagem por situação.

As colunas começam em zero e mostram nomes, números e unidades. Clique, Enter ou Espaço seleciona docente/situação. O nome completo está no rótulo acessível e no título da barra. Os gráficos usam SVG local, sem CDN. Não foram reproduzidas as médias de acesso, as faixas antigas, a mistura de atrasos resolvidos com pendências ou as interpretações causais do HTML original. Não há série histórica inventada.

Acesso representa a última utilização do ambiente Moodle. Não usa a média das disciplinas ou semanas do HTML. As faixas são 0–7 / 8–14 / 15+. Dado ausente é identificado, nunca desenhado como zero. O indicador não mistura dias com percentuais nem gera uma nota ponderada.

Cada atividade mantém datas, prazo, atraso em dias e origem automática/manual. Ação de lupa abre evidências; o registro de materiais fica dentro de Entregas. Troca/regravação preserva versões e exige novo prazo. Publicação é informativa.

Superfícies brancas, largura máxima de 1280px, intervalos de 24px e raio de 16px seguem o arquivo original. Cartões azuis, verdes e rosas usam fundo ligeiramente mais escuro para texto branco legível; o cartão âmbar mantém a cor viva com texto escuro. Ícones usam o mesmo traço Lucide e caixas translúcidas dos indicadores do HTML.

Até 1000px, os cartões passam de quatro para duas colunas, os gráficos para uma e os filtros para duas. Até 620px, cartões e filtros passam para uma coluna. Nomes dos gráficos mantêm tamanho legível com rolagem horizontal. Tabelas preservam colunas com rolagem horizontal. Abas têm teclado/ARIA, diálogos nativos e foco visível; cor é acompanhada de texto.

Notificações ficam em uma prévia acessada no cabeçalho, sem nova aba principal. Ela mostra Para, Cc, texto e HTML. O envio alcança somente a coordenação selecionada. Gráficos e componentes funcionam localmente, sem carregar CDN.

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
