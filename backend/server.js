const express = require('express');
const cors = require('cors');
const { processData } = require('./dataProcessor');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// --- FONTE DE DADOS MOCK ---
// Movido para uma constante global para ser acessível por todas as rotas.
// Esta é a simulação do seu banco de dados.
const mockRawData = [
    // Coordenador: Ana Clara Tomaz (Engenharia, Física)
    { 'Docente': 'João da Silva', 'Disciplina': 'Cálculo I', 'Curso': 'Engenharia', 'Modalidade': 'Presencial', 'Semestre': '2024.1', 'Módulo': 'M1', 'Data Limite Construção': '15/08/2024', 'Entregue': null, 'Dias s/ Acesso': '10', 'Coordenador': 'Ana Clara Tomaz', 'Login': 'ana.tomaz', 'Senha': '123', 'DataTerminoPrevisto': '30/11/2024', 'DataInicioSemestre': '01/08/2024' },
    { 'Docente': 'Maria Oliveira', 'Disciplina': 'Física Quântica', 'Curso': 'Física', 'Modalidade': 'EAD', 'Semestre': '2024.1', 'Módulo': 'M2', 'Data Limite Construção': '10/08/2024', 'Entregue': '12/08/2024', 'Dias s/ Acesso': '5', 'Coordenador': 'Ana Clara Tomaz', 'Login': 'ana.tomaz', 'Senha': 'password123', 'DataTerminoPrevisto': '30/11/2024', 'DataInicioSemestre': '01/08/2024' },
    
    // Coordenador: Marcos Andrade (Ciência da Computação)
    { 'Docente': 'Carlos Pereira', 'Disciplina': 'Algoritmos Avançados', 'Curso': 'Ciência da Computação', 'Modalidade': 'Presencial', 'Semestre': '2024.2', 'Módulo': 'M3', 'Data Limite Construção': '20/09/2024', 'Entregue': '15/09/2024', 'Dias s/ Acesso': '2', 'Coordenador': 'Marcos Andrade', 'Login': 'marcos.andrade', 'Senha': 'senha321', 'DataTerminoPrevisto': '30/12/2024', 'DataInicioSemestre': '01/08/2024' },
    { 'Docente': 'Ana Costa', 'Disciplina': 'Inteligência Artificial', 'Curso': 'Ciência da Computação', 'Modalidade': 'EAD', 'Semestre': '2024.2', 'Módulo': 'M4', 'Data Limite Construção': '25/09/2024', 'Entregue': null, 'Dias s/ Acesso': '20', 'Coordenador': 'Marcos Andrade', 'Login': 'marcos.andrade', 'Senha': 'senha321', 'DataTerminoPrevisto': '30/12/2024', 'DataInicioSemestre': '01/08/2024' },

    // Admin deve ver todos, incluindo este
    { 'Docente': 'Beatriz Lima', 'Disciplina': 'Direito Digital', 'Curso': 'Direito', 'Modalidade': 'Presencial', 'Semestre': '2024.2', 'Módulo': 'M1', 'Data Limite Construção': '30/10/2024', 'Entregue': '28/10/2024', 'Dias s/ Acesso': '1', 'Coordenador': 'Sofia Ribeiro', 'Login': 'sofia.ribeiro', 'Senha': 'senha456', 'DataTerminoPrevisto': '30/12/2024', 'DataInicioSemestre': '01/08/2024' }
];

// Rota de verificação de saúde
app.get('/', (req, res) => {
  res.send('Backend do Discipline Insight Dash está no ar!');
});

// Rota da API para buscar e processar os dados (AGORA COM FILTROS)
app.get('/api/dados', (req, res) => {
  try {
    const { curso, modalidade, semestre, modulo, cursosCoordenador } = req.query;

    let dadosFiltrados = [...mockRawData];

    // 1. Filtro por papel: Coordenador
    // Se o parâmetro `cursosCoordenador` for passado, filtramos primeiro por ele.
    if (cursosCoordenador) {
        const cursosPermitidos = cursosCoordenador.split(',');
        dadosFiltrados = dadosFiltrados.filter(item => cursosPermitidos.includes(item.Curso));
    }
    // Se não for passado, o admin vê tudo, então não fazemos nada.

    // 2. Filtros da UI
    if (curso && curso !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter(item => item.Curso === curso);
    }
    if (modalidade && modalidade !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter(item => item.Modalidade === modalidade);
    }
    if (semestre && semestre !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter(item => item.Semestre === semestre);
    }
    if (modulo && modulo !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter(item => item['Módulo'] === modulo);
    }

    // Processa os dados JÁ FILTRADOS com a lógica de cálculo de status, etc.
    const processed = processData(dadosFiltrados);
    res.json(processed);

  } catch (error) {
    console.error('Erro ao buscar ou processar dados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// NOVA ROTA para obter as opções de filtro
app.get('/api/filter-options', (req, res) => {
    try {
        // As opções são baseadas nos dados brutos completos, para que todos os filtros estejam sempre disponíveis
        const semestres = [...new Set(mockRawData.map(item => item.Semestre).filter(Boolean))].sort();
        const modalidades = [...new Set(mockRawData.map(item => item.Modalidade).filter(Boolean))].sort();
        const modulos = [...new Set(mockRawData.map(item => item['Módulo']).filter(Boolean))].sort();
        const cursos = [...new Set(mockRawData.map(item => item.Curso).filter(Boolean))].sort();

        res.json({ semestres, modalidades, modulos, cursos });
    } catch (error) {
        console.error('Erro ao buscar opções de filtro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// Rota da API para buscar dados dos coordenadores (para autenticação)
app.get('/api/coordinators', (req, res) => {
  try {
    const processedCoordinatorsMap = {};

    mockRawData.forEach((row) => {
      const loginUsername = row['Login']?.trim();
      const coordinatorFullName = row['Coordenador']?.trim();
      const course = row['Curso']?.trim();
      const password = row['Senha']?.trim();

      if (loginUsername && coordinatorFullName) {
        if (!processedCoordinatorsMap[loginUsername]) {
          processedCoordinatorsMap[loginUsername] = { fullName: coordinatorFullName, courses: [], password: password, username: loginUsername };
        }
        if (course && !processedCoordinatorsMap[loginUsername].courses.includes(course)) {
          processedCoordinatorsMap[loginUsername].courses.push(course);
        }
      }
    });

    // Converte o mapa em um array, que é o formato esperado pelo frontend
    const coordinatorsArray = Object.values(processedCoordinatorsMap);
    res.json(coordinatorsArray);

  } catch (error) {
    console.error('Erro ao processar dados dos coordenadores:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const nodemailer = require('nodemailer');

// Rota para envio de e-mail
app.post('/api/send-email', async (req, res) => {
    const { action, dadosDetalhados } = req.body;

    if (!dadosDetalhados || dadosDetalhados.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado fornecido para o e-mail.' });
    }

    try {
        // Cria uma conta de teste no Ethereal
        let testAccount = await nodemailer.createTestAccount();

        // Cria um transportador reutilizável usando os dados da conta de teste
        let transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user, // generated ethereal user
                pass: testAccount.pass, // generated ethereal password
            },
        });

        // Constrói o corpo do e-mail em HTML
        let htmlBody = `<h1>Relatório de Notificação</h1>`;
        htmlBody += `<p>Ação solicitada: <strong>${action}</strong></p>`;
        htmlBody += `<p>Total de registros: <strong>${dadosDetalhados.length}</strong></p>`;
        htmlBody += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                        <thead>
                            <tr>
                                <th>Docente</th>
                                <th>Disciplina</th>
                                <th>Status</th>
                                <th>Dias Calculado</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
        dadosDetalhados.forEach(item => {
            htmlBody += `<tr>
                            <td>${item.Docente}</td>
                            <td>${item.Disciplina}</td>
                            <td>${item.statusCalculado}</td>
                            <td>${item.diasCalculado}</td>
                         </tr>`;
        });

        htmlBody += `</tbody></table>`;

        // Envia o e-mail
        let info = await transporter.sendMail({
            from: '"Sistema de Painel Docente" <noreply@painel.com>',
            to: "coordenador@exemplo.com", // O destinatário pode ser fixo ou vir do request
            subject: `Notificação de Atividades: ${action}`,
            html: htmlBody,
        });

        console.log("E-mail enviado: %s", info.messageId);
        // A URL de preview permite visualizar o e-mail enviado no Ethereal
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log("URL para visualização do e-mail: %s", previewUrl);

        res.status(200).json({ 
            message: "E-mail enviado com sucesso para a caixa de teste!",
            previewUrl: previewUrl 
        });

    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        res.status(500).json({ error: 'Falha ao enviar o e-mail.' });
    }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
