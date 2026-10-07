# Referências e organização da interface

A interface acompanha o trabalho semanal do NED: conferir a tabela, registrar o material manual e preparar os relatórios. A base visual são as planilhas e os e-mails institucionais enviados pelo usuário: cabeçalho azul, nomes completos de disciplinas, datas e situações legíveis.

## Estrutura

| Público | Tela inicial | Detalhes sob demanda |
|---|---|---|
| NED | Conferência por disciplina | Atividades, evidências, ranking e critérios |
| NED — material | Pacote de UAs e cada videoaula | Publicação opcional, justificativa e versões anteriores |
| NED — relatórios | Público, destinatário e texto do e-mail | HTML, qualidade e identificação da coleta |
| Coordenação | Disciplinas autorizadas | Atividades e relatório detalhado |
| Alta gestão | Três indicadores, dois gráficos e Top 5 | Casos relacionados, cálculo e histórico |

O atraso aparece em dias. Entregas com data exata podem mostrar antecipação; uma data apenas observada na coleta não vira data exata de entrega. Pendências sem prazo conhecido ficam a validar. Material replicado e conferido aparece como pronto no prazo, preservando sua classificação separada no cálculo já aprovado.

As abas suportam setas, Home e End; os diálogos usam o elemento nativo dialog. Há foco visível, link para pular o cabeçalho, alvos de interação de 44px e preferência de movimento reduzido. Em telas pequenas, as tabelas rolam horizontalmente para manter as colunas comparáveis.

Durante uma edição manual, salve ou descarte antes de trocar de área ou sair. Edição fica bloqueada durante carregamento/gravação; um erro de coleta desatualizada oferece descarte e recarga. O botão Atualizar dados também recarrega a lista manual.

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

Esta alteração reorganiza o produto existente. A prévia e os downloads usam o HTML/texto do backend; não simulam um XLSX. A integração de e-mail continua sujeita às travas existentes, com envio bloqueado no modo demonstração. Os pesos 50/20/30, as faixas de acesso, as versões de materiais e a exclusão da substitutiva foram preservados.

A verificação automatizada cobre tipos, lint, build, segurança/escopo, regras e apresentação de datas/situações. O navegador remoto deste ambiente bloqueou o endereço localhost:8080 (ERR_BLOCKED_BY_CLIENT); portanto, a inspeção visual e a navegação completa no navegador devem ser conferidas localmente com os passos do README.
