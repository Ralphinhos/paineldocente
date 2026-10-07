# Conferência da interface — layout do HTML

Conferência técnica de 07/10/2026, com dados fictícios em memória. Ela verifica a apresentação dos dados e as ações da aplicação; não homologa dados reais da UNIFENAS.

Atualização de layout baseada diretamente em Análise Docente - Acessos e Atrasos(3).html: cabeçalho branco, quatro indicadores nas cores da referência, panorama com barras agrupadas, Top 10 em pares, evolução e atividades em largura completa, tabela e ranking ponderado expansível. A faixa antiga azul escura foi removida. Regras e integrações do backend não foram alteradas.

A conferência após essa atualização passou novamente em lint, TypeScript, build e 71 testes. Requisições HTTP e componentes React confirmaram os cliques dos indicadores, incluindo todas as pendências, nomes distintos nos eixos, os dois eixos com unidades e a tabela antes do ranking ponderado. Os textos pequenos dos indicadores têm contraste calculado de pelo menos 4,69:1 nos extremos dos gradientes. A aparência no navegador continua entre as conferências pendentes abaixo.

| Conferência | Resultado |
|---|---|
| Lint, TypeScript e build | Passaram em `npm run check` |
| Apresentação, filtros e regras | 11 testes de interface e 60 de backend passaram |
| Inicialização real | `scripts/demo.mjs` inicia Vite e API; o link exibido usa localhost e permite login |
| Indicadores e planilha | Contagens conferem com docentes e itens filtrados; atrasos conferem com datas civis em São Paulo |
| Filtros | Período, modalidade, docente e cada bimestre retornam a seleção correta; paginação e situação não mudam os gráficos nem o ranking |
| Perfis | NED e alta gestão recebem o panorama completo; coordenação recebe somente 1101/1102 na demonstração, inclusive nos filtros, gráficos e relatório |
| Componentes React | Renderização de HTML em Node confirmou sete gráficos principais e um ranking ponderado expansível, docentes da base autorizada, os dois bimestres identificados e uma linha por atividade |
| Materiais manuais | Um pacote de UAs; vídeos conforme a carga horária; entrega de teste com atraso de 2 dias; publicação não altera situação nem ranking |
| Troca de material | Versão 2 de pacote replicado usa prazo próprio, preserva a versão 1 e congela atraso de 1 dia após entregar |
| Proteções | Coordenação/gestão não alteram o NED; CSRF, data futura, justificativa ausente e coleta desatualizada são rejeitados |
| Relatórios | Público forçado conforme perfil; escopo preservado; não aplicável sai da base; tentativa de envio demonstrativo é bloqueada |
| Compatibilidade de e-mail | Nodemailer compôs MIME de texto/HTML em memória para duas coordenações; repetição foi deduplicada; nenhum SMTP externo foi usado |
| Portas e encerramento | Portas 3001/8080 ocupadas causam falha clara; não encerram outro processo; Ctrl+C fecha os serviços do teste |
| Validador da coleta | 57 linhas de demonstração, sem duplicidade ou erro de invariantes; envio bloqueado pelo prazo ausente e catálogo piloto, conforme esperado |

As verificações dos serviços usaram requisições HTTP pelo proxy Vite e os componentes reais alimentados pela resposta da API. A renderização em Node confere conteúdo e números; não verifica layout, cliques, foco ou rolagem em um navegador.

## Dependências verificadas

A checagem do PR identificou alertas altos/críticos no backend. Foram atualizados Nodemailer para 10.0.16, proxy-addr para 2.0.8 e ip-address para 10.7.3. Node.js 22 é o ambiente da CI e do Docker. Os testes de interface também passam a ser executados pela CI.

A auditoria de produção do frontend não encontrou alertas. A do backend não contém alertas altos/críticos após as atualizações. Permanece um aviso moderado de `sprintf-js`, herdado por `tedious`/`mssql`, contabilizado em três pacotes. O aviso não possui versão corrigida publicada; o driver SQL Server foi preservado. Esse resultado não equivale a uma auditoria de produção concluída.

Fontes: [correção de proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [histórico do Nodemailer](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md), [aviso de sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), [transporte em memória](https://nodemailer.com/transports/stream).

## Conferências pendentes

- Layout em Chrome/Edge, incluindo tela estreita, cliques dos gráficos, diálogos, foco e rolagem. O navegador remoto bloqueou localhost e arquivos locais; use `npm run demo` no computador de teste.
- Consulta a uma amostra do Moodle real, prazos oficiais e comparação com as planilhas do NED. Nenhuma conexão ao banco institucional foi usada nesta conferência.
- SMTP institucional, destinatários/cópias e Docker em execução no servidor interno. O envio real continua bloqueado.

## Repetir os testes

Na pasta do projeto, com Node.js 22 e as dependências instaladas:

```bash
npm run check
npm audit --omit=dev --audit-level=high
npm --prefix backend audit --omit=dev --audit-level=high
npm run demo
```

Abra http://localhost:8080 e identifique o cabeçalho branco **Análise de Risco e Desempenho Docente**. Confira os quatro indicadores, duas barras por docente no panorama, os Top 10 em pares e os gráficos inferiores em largura completa. Abra **Ranking docente com pesos** para ver a nota geral. Entre nos três perfis e confira o clique para a planilha, as datas e os relatórios. No perfil NED, registre uma data de docente, salve e consulte o histórico após trocar o pacote ou regravar. Esses registros de demonstração ficam em memória e não são enviados por e-mail.
