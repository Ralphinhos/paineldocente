# Guia do Painel Docente da UNIFENAS

Uso pelo NED e implantação pela TI • Revisão de 20 de outubro de 2026

O painel destaca problemas de acesso e entrega para o NED conferir e comunicar às coordenações. O teste atual usa dados fictícios. A conexão ao Moodle e o envio institucional ainda precisam ser homologados.

## Funcionalidades e teste rápido

| Onde | O que você faz |
| --- | --- |
| Acessos | Vê o último acesso ao ambiente Moodle, uma vez por docente. Rosca, Top 10, prioridades e tabela ajudam a localizar quem precisa de atenção. |
| Entregas | Consulta pendências, prazo, atraso em dias, bimestre, origem e entregas resolvidas. O botão de detalhes mostra o motivo e as evidências. |
| Filtros | Busca docente por nome ou ID e seleciona período, modalidade e disciplina. Clicar nos gráficos filtra a consulta; trocar de página mantém os indicadores. |
| Gráficos | Dicas ao passar o mouse ou focar pelo teclado mostram nomes completos, valores e base dos percentuais. Top 10 mantém até dez linhas; comparações positivas são expansíveis. |
| Registrar UA e videoaulas | Registra datas do docente, dispensa justificada e publicação informativa. Abre nova versão de material com motivo e novo prazo; consulta versões anteriores. |
| Relatório por coordenador | Separa os cursos vinculados no servidor. Mostra Para, Cc, assunto, texto e HTML; permite copiar, baixar o HTML e enviar para a coordenação selecionada, quando liberado. |
| Atualizar dados | Faz uma nova coleta para recalcular a situação. Em produção, o worker também coleta automaticamente; a configuração inicial é diária. |

**Teste no seu computador:** após atualizar o código, execute os comandos abaixo na pasta do projeto. Requer Node.js 22; o teste local dispensa Docker.

```text
npm ci
npm --prefix backend ci
npm run demo
```

Abra http://localhost:8080 e clique em **Abrir demonstração do NED**. Confira o fundo branco dos detalhes, as dicas dos gráficos e a nova tela de entrada. Ctrl+C encerra. Os registros da demonstração são apagados ao encerrar.

## Regras para interpretar os resultados

**Acesso ao ambiente:** 0–7 dias em dia; 8–14 atenção; 15 ou mais crítico. Sem acesso registrado e dado a validar aparecem separadamente. A referência é a data da coleta, no fuso de São Paulo.

| Situação da entrega | Como interpretar |
| --- | --- |
| Antecipada | Data comprovada anterior ao dia do prazo. Uma coleta observada não inventa antecipação. |
| No prazo | Entrega comprovada até o prazo, inclusive no mesmo dia. |
| Replicada no prazo | Estrutura herdada reconhecida e conferida, anterior à responsabilidade do docente. |
| Entregue com atraso | Já resolvida. O atraso fica no histórico e para de crescer. |
| Pendente em atraso | Prazo vencido; o atraso cresce a cada nova coleta até a entrega. |
| Pendente no prazo | Ainda há tempo para entregar; não é uma cobrança vencida. |
| Não aplicável | UA ou vídeo dispensado pelo NED com justificativa; fica fora da base aplicável. |
| A validar | Falta prazo, evidência ou responsável confirmado. Não é prova de falha do docente. |

**Percentuais:** pendências por docente usam itens já exigíveis, com situação e responsável confirmados. Futuro, dispensa e dados a validar ficam fora dessa base. Atraso apenas observado aparece como limite, sem fingir duração exata. Não há nota geral ponderada na interface atual.

**Registro manual:** entre em Entregas → Registrar UA e videoaulas. UA é um pacote único, pela data de envio ao NED. Vídeo usa a data de gravação: 40h = 4 vídeos; 60h = 6. Salve ou descarte antes de sair. Publicação não muda a avaliação da entrega.

**Troca de material:** abra nova versão, informe motivo e novo prazo. Pode substituir um item ou todas as videoaulas da disciplina. A versão anterior permanece no histórico. O semestral separa as avaliações dos dois bimestres; a substitutiva fica fora dos critérios.

## Onde cadastrar os prazos

**Hoje o cadastro geral é no servidor**, no arquivo backend/config/deadlines.json. O NED define e aprova as datas; a TI registra o catálogo. Não existe uma tela de cadastro geral de prazos nesta versão.

| Campo | Para que serve |
| --- | --- |
| periods | Organiza o período letivo, por exemplo 2026/2. |
| MODULAR SEMESTRAL GRADUACAO_EAD | Separa as modalidades dentro do período. |
| defaults | Define o prazo padrão de cada requisito naquela modalidade. |
| courses | Permite um prazo diferente por ID Moodle da disciplina. Tem prioridade sobre o padrão. |
| videos | Aceita uma data comum ou uma lista com uma data por videoaula. A lista deve cobrir todos os vídeos previstos. |
| responsibleTeachers | Define o docente responsável por requisito quando há mais de um na disciplina, usando IDs Moodle. |

**Bimestres:** use avaliacao_bimestral_1 e avaliacao_bimestral_2 com datas próprias. Os demais requisitos também têm chaves específicas, descritas em docs/PRAZOS.md e backend/config/rules.json.

**Rotina para alterar:** o NED aprova as datas; a TI atualiza o arquivo e sua versão; reinicia API e worker; gera nova coleta e confere o resultado antes do envio. O arquivo é montado no Docker como somente leitura para a aplicação.

As datas do catálogo usam ISO UTC; a contagem considera o dia em São Paulo. O exemplo técnico usa 15h UTC, equivalente a 12h em São Paulo, para representar o dia sem virada de data. O horário não antecipa a cobrança dentro do próprio dia.

**Exceção já disponível na tela:** uma nova versão de UA ou vídeo recebe um prazo próprio no formulário. Isso não altera o prazo dos demais itens.

**Limites atuais:** ainda não há tela geral de prazos, ajuste justificado de atividades automáticas do Moodle, cadastro de destinatários na interface ou exportação XLSX por coordenação. Recomendo priorizar a tela de Prazos e exceções antes da operação recorrente. Não altere a data real de entrega para esconder um atraso.

## Conectar ao banco e colocar no servidor

**O próximo passo é um piloto com NED e TI.** A aplicação lê o SQL Server do Moodle e grava coletas, materiais manuais e auditoria em um PostgreSQL próprio. Não escreve no Moodle. O usuário acessa o endereço interno por HTTPS.

1. **Confirmar a fonte.** A TI valida o banco Moodle, tabelas, categoria, papel docente, carga horária e identificação de atividades. Categoria 109 e papel 3 são valores iniciais para conferir. Entregar à TI a consulta backend/sql/moodle-snapshot.sql.
2. **Preparar o servidor.** Linux, Docker Compose, DNS/HTTPS e autenticação institucional OIDC. Criar usuário SQL com SELECT apenas e configurar o certificado de confiança. API e banco ficam na rede interna dos containers.
3. **Configurar.** Copiar .env.production.example para .env.production no servidor. Preencher acesso SQL, segredos, conta NED autorizada, prazos e vínculos de coordenação com Cc. A TI segue GUIA_DEPLOY.md; não enviar senhas por e-mail.
4. **Subir o piloto.** Manter RULES_APPROVED=false e EMAIL_SEND_ENABLED=false. A coleta inicial pode apresentar itens a validar; isso precisa ser resolvido, não interpretado como atraso confirmado.
5. **Comparar dados reais.** Conferir uma amostra nas três modalidades com Moodle e planilhas: acesso, tarefa com conclusão alterada, prazo, dois bimestres, replicação e material manual. A primeira coleta pode não comprovar quando uma estrutura antiga foi entregue.
6. **Liberar gradualmente.** Homologar regras e executar o validador. Depois conferir Para/Cc e testar SMTP com destinatário controlado. Só então habilitar envio e, se desejado, o agendamento semanal no servidor. Configurar backup e testar a restauração do PostgreSQL.

**Comando de validação no servidor após a homologação:**

```text
docker compose --env-file .env.production run --rm api \
  node scripts/validate-snapshot.js --fresh \
  --require-publishable
```

Sem erros de validação e com publishAllowed=true, a coleta está liberada pelas verificações do sistema. Isso complementa a conferência NED/TI; não substitui a comparação com a fonte.

**O que foi verificado nesta revisão:** compilação e 103 testes automáticos; fluxo HTTP de demonstração; gráficos reais renderizados estaticamente. Nenhum e-mail externo foi enviado. A conferência visual completa em Chrome/Edge, o SQL Server, o PostgreSQL, o Docker e o SMTP da Universidade ainda precisam de teste no ambiente institucional.

**Referências no projeto:** README.md para teste; GUIA_DEPLOY.md para a TI; docs/PRAZOS.md para datas; docs/VALIDACAO_REGRAS.md para homologação.
