# Referências e organização da interface

A interface acompanha o trabalho semanal do NED: conferir a tabela, registrar o material manual e preparar os relatórios. A base visual são as planilhas e os e-mails institucionais enviados pelo usuário: cabeçalho azul, nomes completos de disciplinas, datas e situações legíveis.

## Estrutura · Visual 2.0

O HTML fornecido define a composição: filtros visíveis, quatro indicadores coloridos, panorama geral, quatro gráficos Top 10, evolução, atividades com atraso e tabela de todos os docentes. O ranking ponderado é um oitavo gráfico. Explicações e fórmulas ficam nos detalhes.

A planilha define o controle operacional: uma atividade por linha, docente e disciplina repetidos quando necessário, datas civis brasileiras, atraso numérico e células de situação coloridas. Não há expansão obrigatória para encontrar o prazo. Bimestres são identificados pelo requisito real; pacote de UAs permanece único e cada vídeo mantém sua linha.

| Público | Tela inicial | Outras áreas |
|---|---|---|
| NED | Panorama com oito gráficos e tabela de desempenho | Planilha, controle manual, relatórios e e-mails |
| Coordenação | Panorama das disciplinas autorizadas | Planilha e relatório detalhado |
| Alta gestão | Panorama, ranking e evolução | Planilha para investigar os casos |
| Auditoria | Panorama autorizado, somente leitura | Planilha e evidências |

Percentual de atrasos inclui entregas tardias e pendências vencidas, com a mesma base de prazos encerrados do ranking. Percentuais têm peso igual por disciplina. Não se reutilizam as médias de semanas nem a antiga faixa de quatro dias do HTML: acesso usa o maior intervalo nas disciplinas ativas e as faixas aprovadas 0–7 / 8–14 / 15+. Sem registro nunca é convertido em zero; base incompleta fica sem nota geral ou percentual comparável.

O panorama alinha duas áreas de barras: percentual e dias em escalas separadas. Top 10 mantém barras começando em zero; evolução usa datas reais e três séries, sendo entregas tardias um subconjunto das entregues. O gráfico de atividades distingue pendências vencidas de entregas concluídas com atraso, sem duplicar material compartilhado entre docentes.

A tabela de desempenho é a alternativa numérica aos gráficos. As barras e os docentes abrem filtros reais na planilha, incluindo a atividade e o bimestre corretos. A nota não muda ao filtrar apenas a situação das atividades.

As abas suportam setas, Home e End; diálogos usam dialog nativo. Há foco visível, alvos de 44px e preferência de movimento reduzido. O grid de gráficos passa de duas colunas para uma em 800px. Indicadores passam para duas colunas e filtros se reorganizam. Tabelas e gráficos extensos rolam horizontalmente, preservando colunas e valores; a disciplina e o cabeçalho ficam fixos.

Durante uma edição manual, salve ou descarte antes de trocar de área ou sair. O controle mantém bloqueios de concorrência, justificativa, novas versões e histórico. Atualizar dados também recarrega a lista manual.

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

A prévia e os downloads usam o HTML/texto do backend. XLSX por coordenação, cadastro de destinatários/cópias na interface e exceções manuais de atividades Moodle ainda dependem de próxima etapa. A integração de e-mail mantém as travas existentes e está bloqueada no modo demonstração. Foram preservados pesos, faixas de acesso, versões de materiais e exclusão da substitutiva.

A verificação automatizada cobre tipos, lint, build, segurança/escopo, regras, apresentação de datas e situação, bases dos gráficos, ausência de registro, responsabilidade compartilhada e filtros dos dois bimestres. A prévia interativa usa os componentes da aplicação com coletas fictícias e sem persistir alterações.

O navegador remoto deste ambiente bloqueou tanto localhost quanto arquivos locais por política de acesso. A apresentação visual no navegador e os cliques devem ser conferidos no computador de teste com `npm run demo`; há identificação Visual 2.0 no título e no rodapé para distinguir a versão nova.
