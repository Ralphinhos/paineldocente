# Acompanhamento Docente · NED / UNIFENAS

Área interna do NED para identificar problemas pontuais, conferir evidências e preparar notificações por coordenação. A referência visual é o HTML **Análise Docente - Acessos e Atrasos(3).html**.

## Testar sem Docker

Com Node.js 22, encerre o teste anterior com Ctrl+C. Na pasta do projeto:

```bash
npm ci
npm --prefix backend ci
npm run demo
```

Abra [http://localhost:8080](http://localhost:8080) e clique em **Abrir demonstração do NED**. O título é **Acompanhamento docente**, com apenas duas abas principais. Ctrl+C encerra os dois serviços.

O teste usa dados fictícios em memória, coordenações fictícias e envio externo bloqueado. As portas 3001 e 8080 precisam estar livres. Registros de demonstração não persistem após encerrar.

## Duas abas

| Aba | Unidade de acompanhamento | Conteúdo inicial |
|---|---|---|
| Acessos ao ambiente | Um docente, identificado pelo ID do Moodle | Atenção, críticos, sem registro e a validar |
| Entregas | Uma atividade por disciplina e responsável | Somente pendências vencidas, com dias de atraso |

O filtro de docente, período, modalidade e disciplina afeta os números, gráficos e listas das duas abas. Filtrar uma disciplina seleciona os docentes vinculados, preservando seu acesso global. A aba de acessos considera docentes com pelo menos uma disciplina ativa na data da coleta.

As situações e a paginação restringem a lista. Os indicadores e gráficos usam toda a base dos filtros compartilhados. Clicar numa barra seleciona o docente. **Ver todos/Ver todas** permite conferir o restante.

- Acessos: 0–7 dias em dia; 8–14 atenção; 15+ crítico. Sem registro e dado indisponível são distintos.
- Entregas: antecipada, no prazo, replicada e conferida, pendente no prazo, pendente vencida, entregue com atraso, não aplicável e a validar.
- Pendência vencida acumula dias até entregar. Entrega com atraso sai das cobranças abertas e permanece entre as resolvidas.
- Antecipação exige data comprovada. Uma coleta observada não inventa a data exata de entrega.
- Bimestres são requisitos separados. Substitutiva fica fora dos critérios.

## Banco de dados e registro manual

| Informação | Fonte |
|---|---|
| Último acesso ao ambiente | Moodle SQL Server: `mdl_user.lastaccess` |
| Disciplinas, docentes, atividades e eventos | Consulta automática ao Moodle, usuário com SELECT apenas |
| Prazo para o docente | Catálogo oficial homologado; não confundir com prazo do aluno |
| Pacote de UAs | Data em que o docente enviou o pacote completo ao NED |
| Videoaulas | Data da gravação de cada vídeo, registrada pelo NED |

Na aba Entregas, **Registrar UA e videoaulas** abre o controle manual, respeitando o docente selecionado. Existe um pacote por disciplina e uma videoaula para cada 10h. Publicação é informativa. Correção mantém a versão; regravação/troca abre nova versão com motivo, novo prazo e histórico.

O último acesso global não é média de semanas, acesso à disciplina nem data do último login. A consulta preserva esses conceitos separados. Um acesso antigo numa disciplina replicada não torna crítico um docente que acessou o ambiente recentemente. Referência primária: [campos de acesso na API Moodle](https://github.com/moodle/moodle/blob/main/public/enrol/externallib.php).

A coleta usa estado atual e evidências homologadas. Visualizar atividade ou alterar conclusão não prova entrega. Data ou responsável sem comprovação fica **A validar**. Primeira coleta feita após o prazo pode não comprovar quando o material ficou pronto; o sistema mantém essa incerteza.

## Notificar coordenação

O botão **Preparar notificação** mostra texto e HTML com os problemas confirmados dos cursos vinculados ao destinatário e um resumo dos demais itens verificados. Prévia e envio usam a mesma coleta. A prévia abrange os cursos do destinatário, independentemente dos filtros da tela.

O NED confere **Para, Cópia, assunto e conteúdo**. O envio pela interface alcança somente a coordenação selecionada e suas cópias. O relatório não atribui nota nem mistura entregas resolvidas com pendências abertas. Há bloqueio para demonstração, dados incompletos, coleta desatualizada e mudança de coleta após a prévia. Repetir o envio de uma coleta já enviada não cria outra mensagem.

Os destinatários são configurados no servidor. Exemplo com endereços que precisam ser substituídos e homologados:

```json
[{"audience":"coordinators","email":"coordenacao.exemplo@unifenas.br","name":"Coordenação Exemplo","courseIds":["1101","1102"],"cc":["reitoria.exemplo@unifenas.br","proreitoria.exemplo@unifenas.br","diretoria.exemplo@unifenas.br"]}]
```

Use esse JSON em `REPORT_RECIPIENTS_JSON`. `courseIds` são IDs das disciplinas Moodle, obtidos na integração. O sistema não adivinha a relação entre curso acadêmico, campus e coordenador. Ao configurá-la uma vez, a separação e composição dos relatórios são automáticas. O envio semanal por comando passa a usar coordenações por padrão; gestão recebe as cópias configuradas.

A interface é de trabalho do NED. Coordenadores e gestão recebem os relatórios, sem necessidade de outra conta no painel. Permissões de consulta das integrações anteriores permanecem no backend para compatibilidade e isolamento dos relatórios; não há painéis separados na interface.

## Produção no servidor interno

Consulte [GUIA_DEPLOY.md](GUIA_DEPLOY.md) e `.env.production.example`. O servidor precisa de acesso ao SQL Server, PostgreSQL para coletas/histórico, autenticação institucional e SMTP. O navegador não recebe credenciais Moodle.

`backend/config/rules.json` permanece PILOT e `backend/config/deadlines.json` precisa dos prazos oficiais. Só habilite `RULES_APPROVED` e `EMAIL_SEND_ENABLED` após conferir a amostra real e os destinatários com o NED/TI. Não houve conexão ao banco ou SMTP institucional nesta implementação.

Opcional para quem tem Docker instalado:

```bash
docker compose -f compose.demo.yml up --build
```

## Conferência técnica

```bash
npm run check
npm --prefix backend run validate:data -- --fresh
```

A validação cobre limites de acesso, ausência de fonte, duplicidade, docentes com mesmo nome, escopo, prazos, bimestres, responsáveis, materiais manuais, relatórios e Cc. Os componentes reais são renderizados em Node com dados do serviço. Isso verifica conteúdo e números, não aparência ou interação no navegador.

- [Conferência da interface e limites](docs/VALIDACAO_INTERFACE.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Homologação dos dados](docs/VALIDACAO_REGRAS.md)
- [Referências e atribuições](docs/UI_REFERENCIAS.md)
- [Especificação](SPEC.md)

XLSX por coordenação, cadastro de destinatários na interface e exceções manuais para atividades Moodle não fazem parte desta alteração. O controle manual disponível é o de UA e videoaulas.
