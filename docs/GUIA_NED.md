# Guia do Painel Docente da UNIFENAS

Uso pelo NED e Alta Gestão; implantação pela TI • Revisão de 20 de outubro de 2026

O painel destaca problemas de acesso e entrega para o NED conferir e comunicar às coordenações. O teste atual usa dados fictícios. A conexão ao Moodle e o envio institucional ainda precisam ser homologados.

A **Alta Gestão** possui um panorama próprio por semestre e abre os detalhes em leitura. Coordenadores recebem o relatório por e-mail; não têm login. Veja [Visão da Gestão](VISAO_GESTAO.md).

## Funcionalidades e teste rápido

| Onde | O que você faz |
| --- | --- |
| Acessos | Vê o último acesso ao ambiente Moodle, uma vez por docente. Rosca, Top 10, prioridades e tabela ajudam a localizar quem precisa de atenção. |
| Entregas | Consulta pendências, prazo, atraso em dias, bimestre, origem e entregas resolvidas. O botão de detalhes mostra o motivo e as evidências. |
| Filtros | Busca docente por nome ou ID e seleciona período, modalidade e disciplina. Clicar nos gráficos filtra a consulta; trocar de página mantém os indicadores. |
| Gráficos | Dicas ao passar o mouse ou focar pelo teclado mostram nomes completos, valores e base dos percentuais. Top 10 mantém até dez linhas; comparações positivas são expansíveis. |
| Registrar UA e videoaulas | Registra datas do docente, dispensa justificada e publicação informativa. Abre nova versão de material com motivo e novo prazo; consulta versões anteriores. |
| Prazos | Cadastra datas por período e modalidade, com exceções por disciplina e por vídeo. Confere o impacto antes de salvar e registra autor, data e motivo. |
| Relatório por coordenador | Separa os cursos vinculados no servidor. Mostra Para, Cc, assunto, texto e HTML; permite copiar, baixar o HTML e enviar para a coordenação selecionada, quando liberado. |
| Atualizar dados | Faz uma nova coleta para recalcular a situação. Em produção, o worker também coleta automaticamente; a configuração inicial é diária. |

**Teste no seu computador:** após atualizar o código, execute os comandos abaixo na pasta do projeto. Requer Node.js 22; o teste local dispensa Docker.

```text
npm ci
npm --prefix backend ci
npm run demo
```

Abra http://localhost:8080 e clique em **Abrir demonstração do NED**. Confira as quatro abas e alterne para **Alta Gestão** na navegação. Para testar o perfil de consulta, saia e escolha **Abrir Alta Gestão**. Abra um docente para conferir a mesma referência detalhada, sem edição. Ctrl+C encerra. Os registros da demonstração são apagados ao encerrar.

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

**O cadastro fica na aba Prazos**, dentro do painel do NED. Escolha período e modalidade; aplique às disciplinas do recorte ou selecione uma disciplina para uma exceção. Altere as datas, informe o motivo e clique em Revisar alterações. Confira antes e depois; use Confirmar e salvar prazos.

| Campo da tela | Para que serve |
| --- | --- |
| Período | Organiza o período letivo, por exemplo 2026/2. |
| Modalidade | Separa semestral, modular e graduação EaD. |
| Disciplina | Aplica às disciplinas do recorte ou ajusta uma disciplina específica. |
| Datas das atividades | Altera os campos desejados. Os demais prazos permanecem como estão. |
| Datas das videoaulas | Uma data comum; ao selecionar uma disciplina, pode informar uma data por vídeo previsto. |
| Motivo | Registra a justificativa da mudança com autor e data no histórico. |

**Bimestres:** as avaliações bimestrais 1 e 2 possuem campos próprios. Substitutiva fica fora do cadastro de critérios obrigatórios.

**Depois de salvar:** os prazos ficam no banco da aplicação e uma nova coleta é solicitada automaticamente. Confira os indicadores e uma nova prévia antes de enviar relatórios. API e worker usam a versão salva, sem reiniciar. Se a coleta falhar, os prazos ficam salvos e os relatórios permanecem bloqueados até atualizar os dados.

As datas usam o dia em São Paulo. O NED preenche o calendário da tela; a conversão é automática. Relatórios já enviados e coletas anteriores preservam os prazos utilizados. Edição por outra pessoa ou mudança de coleta exige nova conferência.

**Exceção já disponível na tela:** uma nova versão de UA ou vídeo recebe um prazo próprio no formulário. Isso não altera o prazo dos demais itens.

**Limites atuais:** ajuste justificado de atividades automáticas do Moodle, cadastro de destinatários e atribuição de responsáveis compartilhados ainda não têm formulário na interface. A exportação XLSX por coordenação também não está disponível. A aba Prazos mostra as últimas 20 alterações; o banco preserva todas as versões. Não altere a data real de entrega para esconder um atraso.

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

**O que foi verificado:** testes automáticos de regras, API e componentes, incluindo conferência, persistência, concorrência e recálculo dos prazos em memória. Nenhum e-mail externo foi enviado. A conferência visual completa em Chrome/Edge, o SQL Server, o PostgreSQL, o Docker e o SMTP da Universidade ainda precisam de teste no ambiente institucional.

**Referências no projeto:** README.md para teste; GUIA_DEPLOY.md para a TI; docs/PRAZOS.md para datas; docs/VALIDACAO_REGRAS.md para homologação.
