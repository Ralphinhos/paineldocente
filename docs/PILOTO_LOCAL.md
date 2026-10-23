# Teste com dados reais — SQL Server

**Objetivo:** comparar uma amostra real do Moodle com as planilhas atuais. Este piloto roda no seu computador, com autenticação SQL Server por usuário e senha, sem Docker. O comando `npm run demo` continua sendo somente demonstração.

## 1. Preparar

Use Node.js 22 com as dependências instaladas (`npm ci` e `npm --prefix backend ci`). Conecte o computador à rede/VPN da Universidade e encerre o teste anterior com Ctrl+C.

No CMD, dentro da pasta do projeto, faça a cópia **uma vez**:

```cmd
copy .env.piloto.example .env.piloto
notepad .env.piloto
```

Preencha servidor/IP, porta TCP, nome do banco, usuário de consulta e senha. A porta 1433 é um valor inicial: confirme a porta usada pela instância. Para instâncias nomeadas, informe host/IP e porta em campos separados. Use o nome DNS do certificado; TLS e verificação do certificado permanecem habilitados. Se a Universidade usa CA interna, peça o certificado à TI e informe o caminho em `MOODLE_DB_CA_FILE`.

Mantenha a senha entre aspas, especialmente quando tiver `#`, espaços ou caracteres especiais. Não coloque as credenciais no chat, em arquivos de código ou no GitHub. `.env.piloto` e certificados locais são ignorados pelo Git.

Informe de **1 a 10 IDs de disciplinas Moodle**, separados por vírgula, em `MOODLE_COURSE_IDS`. O ID vem da URL da disciplina: `/course/view.php?id=12345` indica `12345`. Se possível, escolha de 5 a 10 disciplinas, com as três modalidades, os dois bimestres e um caso de material replicado. São disciplinas Moodle, não os códigos dos cursos de graduação.

## 2. Testar a conexão

```cmd
npm run piloto:conexao
```

O resultado esperado é **Conexão OK**, seguido da quantidade de disciplinas encontradas. Este teste lê os IDs em `mdl_course`; ainda não valida o mapeamento das atividades ou o cálculo dos indicadores. A senha não é impressa. Para validar o certificado, configure a CA/nome DNS corretos. A alternativa temporária do piloto é descrita abaixo.

### Certificado interno durante o piloto

Algumas ferramentas já confiam na CA do ambiente ou permitem aceitar o certificado do servidor. O painel valida o certificado por padrão. Se a falha for de certificado e você quiser prosseguir com o teste isolado na rede conhecida da Universidade, adicione ao `.env.piloto`:

```env
PILOT_TRUST_SERVER_CERTIFICATE=true
```

Essa opção mantém **TLS/criptografia**, mas dispensa verificar a identidade do servidor SQL. Ela funciona somente nos comandos do piloto local, fica desligada por padrão e aparece no terminal e no aviso do painel quando habilitada. O caminho de CA pode ficar vazio nessa modalidade de teste. Salve e execute novamente `npm run piloto:conexao`; depois de **Conexão OK**, use `npm run piloto`.

Para voltar à validação completa, use `PILOT_TRUST_SERVER_CERTIFICATE=false` e configure o nome DNS e a CA confiável. Na implantação institucional, a conexão continua validando o certificado; a API e o worker normais não usam essa opção do arquivo de piloto.

## 3. Abrir a amostra real

```cmd
npm run piloto
```

O comando verifica novamente a conexão, executa a consulta limitada à amostra e aplica o validador de consistência. A seleção dos IDs ocorre no SQL antes de consultar atividades e logs. Retorno fora da amostra ou ausência de alguma disciplina selecionada interrompem a coleta. A coleta usa `READ COMMITTED`, sem leitura suja, e não escreve no Moodle.

### Conexão OK, mas amostra incompleta

```cmd
npm run piloto:diagnostico
```

O diagnóstico consulta somente os IDs selecionados e mostra, por disciplina: existência, categoria atual, inclusão na categoria raiz, visibilidade, contexto da disciplina e quantidade de usuários não excluídos com o papel docente configurado. Também lista IDs/nomes curtos dos papéis atribuídos diretamente e suas contagens, sem nomes ou e-mails de docentes. Não coleta logs, não abre o painel nem modifica dados/configurações. O comando termina com código 1 se houver algum bloqueio.

`MOODLE_CATEGORY_ROOT=109` e `MOODLE_TEACHER_ROLE_ID=3` são valores iniciais que precisam corresponder à estrutura real. A raiz inclui subcategorias. Confirme os valores com NED/TI antes de editar `.env.piloto`; a lista de papéis não transforma automaticamente outro perfil em docente. A coleta exige, por padrão, disciplina visível e atribuição direta do papel no contexto da disciplina; atribuições herdadas de categoria/sistema não são usadas. Uma disciplina sem atividades ainda pode passar esses filtros, pois as atividades entram por junção opcional. Filtros de entrada OK não validam os logs, as entregas ou os prazos.

Se o único bloqueio for **disciplina oculta**, você pode testar a mesma disciplina incluindo no `.env.piloto`:

```env
PILOT_INCLUDE_HIDDEN_COURSES=true
```

A opção permite consultar disciplinas ocultas **somente dentre os 1 a 10 IDs selecionados**. Não altera a visibilidade ou qualquer dado no Moodle. Os filtros de categoria, vínculo docente e escopo continuam valendo. Terminal, diagnóstico e faixa do painel identificam essa opção. O padrão é `false`, e a API/worker normais não usam essa variável do piloto. Para análise institucional de disciplinas encerradas, a regra definitiva de inclusão ainda precisa ser homologada com NED/TI.

Depois de conferir e corrigir a configuração ou o mapeamento com a TI, execute novamente `npm run piloto`.

### Datas técnicas do Moodle

No detalhe da entrega, **Conferir evidências** mostra também a inclusão da atividade no curso, a última alteração da instância (Tarefa, Fórum e Questionário) e o último registro de alteração do módulo por qualquer usuário na janela consultada, quando disponíveis. Essas datas vêm automaticamente do Moodle e são identificadas como contexto técnico; não são preenchimento manual de entrega.

### Seleção da atividade e comprovação de preparo

O nome da atividade é combinado com seu tipo: **Desafio → Tarefa (`assign`)**, **fóruns → Fórum (`forum`)** e **avaliações → Questionário (`quiz`)**. Quando existe atividade do tipo esperado, um LTI/URL de mesmo nome não entra na contagem desse requisito. Dois candidatos do tipo esperado continuam ambíguos. Se só houver tipo diferente, o item fica **a validar**, sem virar falta docente. Conflito entre módulo esperado oculto e outro tipo visível também exige conferência.

O sistema pode reconhecer **entrega no prazo** quando há comprovação de preparo até uma data que pertence ao prazo definido pelo NED:

| Tipo | Comprovação usada |
| --- | --- |
| Tarefa | Conteúdo na descrição/instruções, última alteração da instância e registro de alteração do módulo compatível; vale a mais recente dessas datas e da inclusão no curso |
| Fórum | Tópico inicial de docente vinculado, não excluído/nem privado, com conteúdo; considera criação/edição do post, alteração da instância e registro de alteração do módulo |
| Questionário | Posições de questões existentes e tentativa concluída sem prévia por usuário fora dos docentes vinculados, iniciada a partir do início da disciplina; o término comprova que o questionário era utilizável até aquela data |

Essa comprovação é um **limite de data**, não o instante da primeira entrega. O detalhe mostra **Preparo comprovado até**; não concede antecipação nem calcula atraso exato a partir desse limite. Evidência posterior ao prazo permanece **a validar**, pois a atividade pode ter ficado pronta antes e recebido ajustes depois. Uma comprovação anterior é preservada nas coletas seguintes, para o mesmo prazo. Mudança de prazo exige nova avaliação.

Módulo visível vazio não comprova preparo. A descrição do Fórum pode estar vazia quando o enunciado está no tópico inicial. A qualidade pedagógica do conteúdo não é avaliada por essas verificações estruturais. Datas de UAs e videoaulas continuam exclusivamente manuais; os critérios de observação entre coletas e de material herdado continuam aplicáveis.

### Validar as datas automáticas com uma disciplina real

Mantenha o piloto aberto para preservar os prazos temporários e use outro CMD na pasta do projeto:

```cmd
npm run piloto:evidencias
```

O comando consulta os mesmos IDs e termina sem abrir servidor ou painel. O resumo mostra IDs de disciplina, módulo e docente; datas técnicas de criação/alteração; registros de edição, conclusão e visualização; contagem de posições de questões e tópicos, quando disponíveis. Também indica o candidato selecionado/excluído, se o tópico inicial pertence ao docente do vínculo e suas datas, o primeiro uso concluído da avaliação e eventual comprovação de preparo por data. Não imprime nomes/e-mails, textos das atividades, questões ou credenciais. O conteúdo usado na verificação é lido temporariamente, sem ser gravado no histórico ou incluído nas respostas do painel. A descrição preenchida significa somente campo não vazio no banco, e as contagens isoladas não validam o conteúdo ou a autoria. A consulta usa somente leitura e mantém os filtros de categoria, papel, visibilidade/opção explícita de ocultas e limite da amostra.

Os logs respeitam `MOODLE_QUERY_WINDOW_DAYS` (padrão 90); “sem registro” pode significar evento fora da janela ou histórico removido. Inclusão/última alteração da instância, tópico inicial e usos concluídos vêm dos registros atuais, independentemente dessa janela; os usos considerados foram iniciados a partir do início da disciplina. A primeira edição mostrada é a primeira **na janela**, não a primeira edição de toda a vida da atividade.

Compare essa saída com o histórico da mesma atividade no Moodle e com a planilha oficial. O sistema mantém **a validar** quando não consegue comprovar preparo até o prazo nem inferir atraso com observações confiáveis. Não usar uma edição posterior, visualização ou alteração de conclusão como entrega/atraso presumido. UAs e videoaulas seguem com suas datas manuais de envio/gravação. A homologação final desse mapeamento depende da conferência da amostra real pelo NED.

Referências do esquema Moodle 5.0: [course_modules](https://github.com/moodle/moodle/blob/MOODLE_500_STABLE/lib/db/install.xml), [Tarefa](https://github.com/moodle/moodle/blob/MOODLE_500_STABLE/mod/assign/db/install.xml), [Fórum](https://github.com/moodle/moodle/blob/MOODLE_500_STABLE/mod/forum/db/install.xml) e [Questionário](https://github.com/moodle/moodle/blob/MOODLE_500_STABLE/mod/quiz/db/install.xml).

### Conferir no painel

Abra **http://127.0.0.1:8080/acompanhamento**. A entrada do NED é automática, somente neste piloto local. O cabeçalho identifica os dados reais em validação. A API também fica limitada a `127.0.0.1`; solicitações diretas à API não recebem a identidade local. Não publique nem exponha esse modo na rede.

Sem prazo oficial, o item fica a validar. Use a aba **Prazos** para informar as datas da amostra, revise e salve. A primeira coleta com prazos salvos pode ainda não comprovar a data de entrega de material antigo. Use **Entregas → Registrar UA e videoaulas** para registrar o envio do pacote de UAs e a gravação de cada vídeo. Abra **Alta Gestão** para conferir a mesma amostra no panorama semestral.

## 4. Conferir antes de aprovar

| Conferência | Resultado esperado |
| --- | --- |
| Disciplinas e docentes | Mesmos IDs e vínculos do Moodle, sem misturar homônimos |
| Acesso | Último acesso ao ambiente, com 0–7 / 8–14 / 15+ dias |
| Entregas | Prazo oficial e situação conferidos com a planilha; dias de atraso corretos |
| Evidências | Alteração de conclusão não comprova entrega; data incerta permanece a validar |
| Exceções | Conferir material replicado, responsabilidade compartilhada e dois bimestres |

O comando valida invariantes, como duplicação de chave e inconsistências de acesso. **Consistência estrutural OK não significa que o mapeamento real foi homologado.** Registre qualquer divergência e confira com o NED/TI antes de usar o resultado para cobranças. O diagnóstico e as demais correções da auditoria continuam pendentes; este piloto não as declara concluídas.

## Limites deste primeiro teste

Prazos, UA/vídeos, versões e coletas são temporários em memória. Ctrl+C encerra o painel e descarta esses registros; não substitua a planilha oficial pelo piloto. A consulta começa sem histórico: o gráfico só terá outras referências após novas coletas comparáveis. O critério de uma referência por semana continua valendo.

O piloto força `RULES_APPROVED=false`, `EMAIL_SEND_ENABLED=false` e destinatários vazios, mesmo que outra configuração tente habilitá-los. Não há mensagens externas. A publicação institucional requer PostgreSQL próprio para persistência, autenticação institucional, homologação do SQL e das regras, correções pendentes da auditoria e teste dos destinatários/SMTP.
