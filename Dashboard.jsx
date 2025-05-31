
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User } from "@/api/entities";
import { Cliente } from "@/api/entities";
import { Veiculo } from "@/api/entities";
import { DVPF } from "@/api/entities";
import { Entrada } from "@/api/entities";
import { EntradaItem } from "@/api/entities";
import { Saida } from "@/api/entities";
import { SaidaItem } from "@/api/entities";
import { Especie } from "@/api/entities";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { FileBarChart2, Users, Truck, FileText, LogIn, LogOut, AlertTriangle, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Dashboard() {
  const [clientesCount, setClientesCount] = useState(0);
  const [veiculosCount, setVeiculosCount] = useState(0);
  const [dvpfCount, setDvpfCount] = useState(0);
  const [entradasCount, setEntradasCount] = useState(0);
  const [saidasCount, setSaidasCount] = useState(0);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dvpfVencidos, setDvpfVencidos] = useState(0);
  const [entradas, setEntradas] = useState([]);
  const [entradaItens, setEntradaItens] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [saidaItens, setSaidaItens] = useState([]);
  const [especies, setEspecies] = useState([]);
  
  // Dados para o gráfico
  const [volumeData, setVolumeData] = useState([]);
  const [especiesData, setEspeciesData] = useState([]);

  const COLORS = ['#16a34a', '#f97316', '#0ea5e9', '#8b5cf6', '#ec4899', '#facc15', '#64748b', '#ef4444', '#f59e0b']; // Adicionei mais cores

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const userData = await User.me();
      setUser(userData);
      
      // Carregar contagens e dados
      const [
        clientes,
        veiculos,
        dvpfs,
        entradasData,
        entradaItensData,
        saidasData,
        saidaItensData,
        especiesData
      ] = await Promise.all([
        Cliente.list(),
        Veiculo.list(),
        DVPF.list(),
        Entrada.list('-data'),
        EntradaItem.list(),
        Saida.list('-data'),
        SaidaItem.list(),
        Especie.list()
      ]);
      
      setClientesCount(clientes.length);
      setVeiculosCount(veiculos.length);
      setDvpfCount(dvpfs.length);
      setEntradas(entradasData);
      setEntradaItens(entradaItensData);
      setSaidas(saidasData);
      setSaidaItens(saidaItensData);
      setEspecies(especiesData);
      setEntradasCount(entradasData.length);
      setSaidasCount(saidasData.length);
      
      // Contar DVPFs vencidos
      const hoje = new Date();
      const vencidos = dvpfs.filter(d => new Date(d.data_validade) < hoje).length;
      setDvpfVencidos(vencidos);
      
      // Processar dados para gráficos
      processarDadosGraficos(entradasData, entradaItensData, saidasData, saidaItensData, especiesData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const processarDadosGraficos = (entradasData, entradaItensData, saidasData, saidaItensData, especiesData) => {
    // Preparar dados de volume por mês
    const volumesPorMes = {};
    const mesesOrdenados = [];

    const getMesAnoKey = (dataObj) => {
      const mes = dataObj.getMonth(); // 0-11
      const ano = dataObj.getFullYear();
      return `${ano}-${String(mes).padStart(2, '0')}`; // Chave YYYY-MM para ordenação
    };
    
    const formatarLabelMes = (dataObj) => {
        return dataObj.toLocaleString('default', { month: 'short' });
    }

    entradasData.forEach(entrada => {
      const data = new Date(entrada.data);
      const chave = getMesAnoKey(data);
      const labelMes = formatarLabelMes(data);
      
      if (!volumesPorMes[chave]) {
        volumesPorMes[chave] = { name: labelMes, entrada: 0, saida: 0, originalKey: chave };
        mesesOrdenados.push(chave);
      }
      volumesPorMes[chave].entrada += entrada.volume_comercial_total || 0;
    });
    
    saidasData.forEach(saida => {
      const data = new Date(saida.data);
      const chave = getMesAnoKey(data);
      const labelMes = formatarLabelMes(data);
      
      if (!volumesPorMes[chave]) {
        volumesPorMes[chave] = { name: labelMes, entrada: 0, saida: 0, originalKey: chave };
         mesesOrdenados.push(chave);
      }
      volumesPorMes[chave].saida += saida.volume_comercial_total || 0;
    });
    
    // Ordenar as chaves e depois pegar os valores
    const chavesUnicasOrdenadas = [...new Set(mesesOrdenados)].sort();
    const volumeDataArray = chavesUnicasOrdenadas.map(key => volumesPorMes[key]);
    
    setVolumeData(volumeDataArray.slice(-6)); // Pegar os últimos 6 meses para o gráfico
    
    // Preparar dados de espécies (Estoque = Entradas - Saídas)
    const estoquePorEspecie = {};
    
    entradaItensData.forEach(item => {
      const especieId = item.especie_id;
      if (!estoquePorEspecie[especieId]) {
        const especie = especiesData.find(e => e.id === especieId);
        estoquePorEspecie[especieId] = {
          id: especieId,
          name: especie ? especie.nome : 'Desconhecido',
          value: 0 // Volume em estoque
        };
      }
      estoquePorEspecie[especieId].value += (item.volume_comercial || 0);
    });
    
    saidaItensData.forEach(item => {
      const especieId = item.especie_id;
      // Se a espécie já existe no mapa (veio de uma entrada), subtraia o volume de saída
      if (estoquePorEspecie[especieId]) {
        estoquePorEspecie[especieId].value -= (item.volume_comercial || 0);
      } 
      // Se não existe (saída sem entrada correspondente, o que é incomum mas possível), 
      // podemos optar por não mostrar ou mostrar como negativo (não ideal para gráfico de pizza)
      // Por ora, só consideramos o que tem entrada.
    });
    
    // Converter para array, filtrar valores positivos e ordenar
    const especiesEstoqueArray = Object.values(estoquePorEspecie)
      .filter(item => item.value > 0.0005) // Filtrar valores muito pequenos para evitar problemas com toFixed(3)
      .sort((a, b) => b.value - a.value) 
      .slice(0, COLORS.length); // Limitar ao número de cores disponíveis
    
    setEspeciesData(especiesEstoqueArray);
  };

  // Calcular totais
  const totalVolume = useMemo(() => {
    const entradaTotal = entradaItens.reduce((sum, item) => sum + (item.volume_comercial || 0), 0);
    const saidaTotal = saidaItens.reduce((sum, item) => sum + (item.volume_comercial || 0), 0);
    return {
      entrada: parseFloat(entradaTotal.toFixed(3)),
      saida: parseFloat(saidaTotal.toFixed(3)),
      estoque: parseFloat((entradaTotal - saidaTotal).toFixed(3))
    };
  }, [entradaItens, saidaItens]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">
          Olá, {user?.full_name?.split(' ')[0] || 'Bem-vindo'}!
        </h1>
        <div className="flex items-center text-gray-500 gap-2">
          <Calendar className="h-4 w-4" />
          <p>
            {new Date().toLocaleDateString('pt-BR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-emerald-200 hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardDescription>Total de</CardDescription>
            <CardTitle className="text-xl flex justify-between items-center">
              Clientes
              <Users className="h-5 w-5 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{clientesCount}</div>
            <Link 
              to={createPageUrl("Clientes")}
              className="mt-2 inline-block text-xs text-emerald-600 hover:underline"
            >
              Ver todos os clientes
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardDescription>Total de</CardDescription>
            <CardTitle className="text-xl flex justify-between items-center">
              Veículos
              <Truck className="h-5 w-5 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{veiculosCount}</div>
            <Link 
              to={createPageUrl("Veiculos")}
              className="mt-2 inline-block text-xs text-blue-600 hover:underline"
            >
              Ver todos os veículos
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardDescription>Total de</CardDescription>
            <CardTitle className="text-xl flex justify-between items-center">
              DVPF
              <FileText className="h-5 w-5 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{dvpfCount}</div>
            {dvpfVencidos > 0 && (
              <div className="flex items-center text-red-600 text-sm mt-2">
                <AlertTriangle className="h-4 w-4 mr-1" />
                {dvpfVencidos} vencidos
              </div>
            )}
            <Link 
              to={createPageUrl("DVPF")}
              className="mt-2 inline-block text-xs text-amber-600 hover:underline"
            >
              Ver todos os DVPFs
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardDescription>Total de</CardDescription>
            <CardTitle className="text-xl flex justify-between items-center">
              Entradas
              <LogIn className="h-5 w-5 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{entradasCount}</div>
            <div className="text-sm text-purple-600 mt-1">
              Vol: {totalVolume.entrada.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³
            </div>
            <Link 
              to={createPageUrl("Entradas")}
              className="mt-1 inline-block text-xs text-purple-600 hover:underline"
            >
              Ver todas as entradas
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200 hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardDescription>Total de</CardDescription>
            <CardTitle className="text-xl flex justify-between items-center">
              Saídas
              <LogOut className="h-5 w-5 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-700">{saidasCount}</div>
            <div className="text-sm text-rose-600 mt-1">
              Vol: {totalVolume.saida.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³
            </div>
            <Link 
              to={createPageUrl("Saidas")}
              className="mt-1 inline-block text-xs text-rose-600 hover:underline"
            >
              Ver todas as saídas
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Card de Estoque */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow">
        <CardHeader>
          <CardTitle className="flex items-center text-emerald-800">
            <FileBarChart2 className="h-5 w-5 mr-2 text-emerald-600" />
            Resumo de Estoque
          </CardTitle>
          <CardDescription>
            Volume total em estoque: {totalVolume.estoque.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg border border-emerald-100 text-center">
              <p className="text-sm text-gray-500">Volume Total de Entrada</p>
              <p className="text-2xl font-bold text-emerald-700">{totalVolume.entrada.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-rose-100 text-center">
              <p className="text-sm text-gray-500">Volume Total de Saída</p>
              <p className="text-2xl font-bold text-rose-700">{totalVolume.saida.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-amber-100 text-center">
              <p className="text-sm text-gray-500">Saldo em Estoque</p>
              <p className="text-2xl font-bold text-amber-700">{totalVolume.estoque.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileBarChart2 className="h-5 w-5 mr-2 text-emerald-600" />
              Comparativo de Volume (Entrada vs Saída)
            </CardTitle>
            <CardDescription>Últimos 6 meses (Volume Comercial)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {volumeData.length > 0 ? (
                  <BarChart
                    data={volumeData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => value.toLocaleString('pt-BR', {maximumFractionDigits: 1})} />
                    <Tooltip 
                      formatter={(value) => [`${parseFloat(value).toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³`, null]}
                      labelFormatter={(label) => `Mês: ${label}`} // O label já é o nome curto do mês
                    />
                    <Bar dataKey="entrada" name="Entrada (m³)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saida" name="Saída (m³)" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    Não há dados suficientes para gerar o gráfico
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileBarChart2 className="h-5 w-5 mr-2 text-emerald-600" />
              Distribuição de Madeira por Espécie
            </CardTitle>
            <CardDescription>Estoque atual (Volume Comercial)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {especiesData.length > 0 ? (
                  <PieChart>
                    <Pie
                      data={especiesData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent, value }) => `${name}: ${(percent * 100).toFixed(1)}% (${parseFloat(value).toLocaleString('pt-BR', {minimumFractionDigits:3, maximumFractionDigits:3})} m³)`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {especiesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${parseFloat(value).toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³`, null]} />
                  </PieChart>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    Não há dados suficientes para gerar o gráfico
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Lembretes */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:shadow-md transition-all">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
            Alertas e Lembretes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dvpfVencidos > 0 ? (
              <div className="p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between">
                <div>
                  <p className="font-medium text-amber-800">Existem {dvpfVencidos} DVPFs vencidos</p>
                  <p className="text-amber-600 text-sm">Verifique e atualize os documentos expirados.</p>
                </div>
                <Link to={createPageUrl("DVPF")}>
                  <Button variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50">
                    Ver detalhes
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-lg border border-green-200 flex items-center">
                <div className="bg-green-100 text-green-700 p-2 rounded-full mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-green-800">Todos os DVPFs estão com a documentação em dia.</p>
              </div>
            )}
            
            {totalVolume.estoque < 10 && (
              <div className="p-3 bg-white rounded-lg border border-red-200 flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-800">Estoque baixo</p>
                  <p className="text-red-600 text-sm">O volume em estoque está abaixo de 10m³.</p>
                </div>
                <Link to={createPageUrl("Relatorios")}>
                  <Button variant="outline" className="border-red-500 text-red-700 hover:bg-red-50">
                    Ver relatório
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
