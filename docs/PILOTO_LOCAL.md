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

O comando verifica novamente a conexão, executa a consulta limitada à amostra e aplica o validador de consistência. A seleção dos IDs ocorre no SQL antes de consultar atividades e logs. Retorno fora da amostra ou ausência de alguma disciplina selecionada interrompem a coleta. Nesse último caso, confira também categoria 109, visibilidade e papel docente configurado. A coleta usa `READ COMMITTED`, sem leitura suja, e não escreve no Moodle.

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
