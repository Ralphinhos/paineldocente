import React, { useMemo } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis,
  LineChart, Line, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Download } from 'lucide-react';

export const InteligenciaAnalitica: React.FC = () => {
  const { allData, historyList } = useDataContext();

  // 1. Processamento para a Matriz de Risco Docente (Scatter Plot)
  const riscoDocenteData = useMemo(() => {
    const mapa = allData.reduce((acc, item) => {
      const docente = item.Docente;
      if (!docente) return acc;
      
      if (!acc[docente]) {
        acc[docente] = {
          nome: docente,
          atrasos: 0,
          diasSemAcesso: item['Dias s/ Acesso'] || 0,
          coordenador: item.Coordenador
        };
      }
      
      if (item.isAtrasado) acc[docente].atrasos += 1;
      // Pega o maior número de dias sem acesso associado a esse docente
      acc[docente].diasSemAcesso = Math.max(acc[docente].diasSemAcesso, item['Dias s/ Acesso'] || 0);
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(mapa).filter(d => d.atrasos > 0 || d.diasSemAcesso > 0);
  }, [allData]);

  // 2. Simulação de Dados para Série Temporal (Evolução)
  // Nota: O ideal é criar uma rota no backend /api/history/stats para retornar isso pronto
  const evolucaoData = useMemo(() => {
    // Aqui usamos o historyList real apenas para os rótulos, 
    // mas os dados em um cenário real viriam do processamento do backend.
    return historyList.slice(0, 5).reverse().map((hist, index) => ({
      data: new Date(hist.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      pendencias: Math.floor(Math.random() * 50) + 100, // Substitua pelo dado real do backend
      atrasos: Math.floor(Math.random() * 30) + 40,     // Substitua pelo dado real do backend
    }));
  }, [historyList]);

  // 3. Função de Exportação Visual (Excel)
  const handleExportExcel = () => {
    // Formata os dados para ficarem bonitos no Excel
    const dadosFormatados = allData.map(item => ({
      'Docente': item.Docente,
      'Curso': item.Curso,
      'Disciplina': item.Disciplina,
      'Atividade': item.Atividade,
      'Situação': item.statusCalculado,
      'Dias s/ Acesso': item['Dias s/ Acesso'],
      'Coordenador': item.Coordenador
    }));

    const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visão Atual");
    
    // Baixa o arquivo automaticamente
    XLSX.writeFile(workbook, `Relatorio_NED_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  const CustomTooltipRisco = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg text-sm">
          <p className="font-bold text-gray-800">{data.nome}</p>
          <p className="text-red-600">Atrasos: {data.atrasos}</p>
          <p className="text-orange-600">Dias s/ Acesso: {data.diasSemAcesso}</p>
          <p className="text-gray-500 text-xs mt-1">Coord: {data.coordenador}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inteligência Analítica</h2>
          <p className="text-muted-foreground">Análise de tendências e matriz de risco docente.</p>
        </div>
        <Button onClick={handleExportExcel} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar Excel (Visão Atual)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO 1: Matriz de Risco (Scatter Plot) */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Matriz de Risco Docente</CardTitle>
            <p className="text-sm text-gray-500">
              Cruzamento entre quantidade de dias sem acessar o sistema (Eixo X) e volume de atividades em atraso (Eixo Y).
              Foque no quadrante superior direito (Zona Crítica).
            </p>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="diasSemAcesso" name="Dias s/ Acesso" unit=" dias" />
                <YAxis type="number" dataKey="atrasos" name="Atividades Atrasadas" />
                <ZAxis type="number" range={[100, 100]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltipRisco />} />
                <Scatter name="Docentes" data={riscoDocenteData} fill="#ef4444" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* GRÁFICO 2: Evolução (Line Chart) */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução de Pendências (Últimos 5 relatórios)</CardTitle>
            <p className="text-sm text-gray-500">
              Tendência de crescimento ou redução de gargalos ao longo do semestre.
            </p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="pendencias" name="Total de Pendências" stroke="#3b82f6" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="atrasos" name="Atividades Atrasadas" stroke="#ef4444" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};