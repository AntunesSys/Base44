
import React, { useState, useEffect } from "react";
import { Notificacao } from "@/api/entities";
import { DVPF } from "@/api/entities";
import { Entrada } from "@/api/entities";
import { EntradaItem } from "@/api/entities";
import { Saida } from "@/api/entities";
import { SaidaItem } from "@/api/entities";
import { Cliente } from "@/api/entities";
import { Explorador } from "@/api/entities";
import { Romaneador } from "@/api/entities";
import { Veiculo } from "@/api/entities";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Bell,
  Check,
  FileText,
  LogIn,
  LogOut,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dvpfs, setDvpfs] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [exploradores, setExploradores] = useState([]);
  const [romaneadores, setRomaneadores] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dados para resumo
  const [resumoDVPF, setResumoDVPF] = useState({
    count: 0,
    ultimasDVPFs: []
  });
  const [resumoEntrada, setResumoEntrada] = useState({
    count: 0,
    volumeTotal: 0,
    ultimasEntradas: []
  });
  const [resumoSaida, setResumoSaida] = useState({
    count: 0,
    volumeTotal: 0,
    ultimasSaidas: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar notificações
      const notificacoesData = await Notificacao.list('-data');
      setNotificacoes(notificacoesData);
      
      // Carregar todos os dados necessários para resumos
      const [dvpfsData, entradasData, saidasData, clientesData, exploradoresData, romaneadoresData, veiculosData] = await Promise.all([
        DVPF.list('-created_date'),
        Entrada.list('-created_date'),
        Saida.list('-created_date'),
        Cliente.list(),
        Explorador.list(),
        Romaneador.list(),
        Veiculo.list()
      ]);
      
      setDvpfs(dvpfsData);
      setEntradas(entradasData);
      setSaidas(saidasData);
      setClientes(clientesData);
      setExploradores(exploradoresData);
      setRomaneadores(romaneadoresData);
      setVeiculos(veiculosData);
      
      // Preparar resumo de DVPFs
      const ultimas5DVPFs = dvpfsData.slice(0, 5);
      setResumoDVPF({
        count: dvpfsData.length,
        ultimasDVPFs: ultimas5DVPFs
      });
      
      // Preparar resumo de Entradas
      const ultimas5Entradas = entradasData.slice(0, 5);
      const volumeTotalEntrada = entradasData.reduce((total, entrada) => total + (entrada.volume_florestal_total || 0), 0);
      setResumoEntrada({
        count: entradasData.length,
        volumeTotal: volumeTotalEntrada,
        ultimasEntradas: ultimas5Entradas
      });
      
      // Preparar resumo de Saídas
      const ultimas5Saidas = saidasData.slice(0, 5);
      const volumeTotalSaida = saidasData.reduce((total, saida) => total + (saida.volume_comercial_total || 0), 0);
      setResumoSaida({
        count: saidasData.length,
        volumeTotal: volumeTotalSaida,
        ultimasSaidas: ultimas5Saidas
      });
      
      // Marcar notificações não lidas como lidas
      const notificacoesNaoLidas = notificacoesData.filter(n => !n.lida);
      for (const notificacao of notificacoesNaoLidas) {
        await Notificacao.update(notificacao.id, { lida: true });
      }
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotificacao = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta notificação?")) {
      try {
        await Notificacao.delete(id);
        setNotificacoes(prevNotificacoes => prevNotificacoes.filter(notif => notif.id !== id));
      } catch (error) {
        console.error("Erro ao excluir notificação:", error);
      }
    }
  };

  const handleLimparTodas = async () => {
    if (window.confirm("Tem certeza que deseja excluir todas as notificações?")) {
      try {
        for (const notificacao of notificacoes) {
          await Notificacao.delete(notificacao.id);
        }
        setNotificacoes([]);
      } catch (error) {
        console.error("Erro ao excluir notificações:", error);
      }
    }
  };

  // Funções auxiliares para obter nomes
  const getClienteName = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nome : "Cliente não encontrado";
  };

  const getExplorador = (exploradorId) => {
    const explorador = exploradores.find(e => e.id === exploradorId);
    return explorador ? explorador.nome : "Explorador não encontrado";
  };

  const getRomaneador = (romaneadorId) => {
    const romaneador = romaneadores.find(r => r.id === romaneadorId);
    return romaneador ? romaneador.nome : "Romaneador não encontrado";
  };
  
  const getVeiculo = (veiculoId) => {
    const veiculo = veiculos.find(v => v.id === veiculoId);
    return veiculo ? `${veiculo.placa_cavalo} - ${veiculo.nome_motorista || ""}` : "Veículo não encontrado";
  };

  const getClienteFromDVPF = (dvpfId) => {
    const dvpf = dvpfs.find(d => d.id === dvpfId);
    if (dvpf) {
      return getClienteName(dvpf.cliente_id);
    }
    return "Cliente não encontrado";
  };

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch(e) {
      return "Data inválida";
    }
  };

  const formatDateTime = (dateString) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm");
    } catch(e) {
      return "Data inválida";
    }
  };

  // Função para marcar todas as notificações como lidas
  const marcarTodasComoLidas = async () => {
    setLoading(true);
    try {
      const notificacoesNaoLidas = notificacoes.filter(n => !n.lida);
      
      // Atualizar todas as notificações não lidas
      for (const notificacao of notificacoesNaoLidas) {
        await Notificacao.update(notificacao.id, { ...notificacao, lida: true });
      }
      
      // Recarregar notificações
      await loadData();
      
      // Exibir mensagem de sucesso
      setSuccess("Todas as notificações foram marcadas como lidas!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Erro ao marcar notificações como lidas:", error);
      setError("Falha ao marcar notificações como lidas.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Função para excluir todas as notificações
  const excluirTodasNotificacoes = async () => {
    if (!window.confirm("Tem certeza que deseja excluir todas as notificações?")) {
      return;
    }
    
    setLoading(true);
    try {
      // Excluir todas as notificações
      for (const notificacao of notificacoes) {
        await Notificacao.delete(notificacao.id);
      }
      
      // Recarregar notificações
      await loadData();
      
      // Exibir mensagem de sucesso
      setSuccess("Todas as notificações foram excluídas!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Erro ao excluir notificações:", error);
      setError("Falha ao excluir notificações.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">Notificações</h1>
        {notificacoes.length > 0 && (
          <Button 
            onClick={handleLimparTodas} 
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Todas
          </Button>
        )}
      </div>
      
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
        </div>
      ) : (
        <Tabs defaultValue="todas">
          <TabsList className="grid w-full grid-cols-4 max-w-md">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="dvpf">DVPFs</TabsTrigger>
            <TabsTrigger value="entrada">Entradas</TabsTrigger>
            <TabsTrigger value="saida">Saídas</TabsTrigger>
          </TabsList>
          
          {/* Tab com todas as notificações */}
          <TabsContent value="todas" className="space-y-4 mt-4">
            {/* Lista de notificações */}
            {notificacoes.length > 0 ? (
              notificacoes.map((notificacao) => (
                <Card key={notificacao.id} className={`
                  ${notificacao.tipo === 'alerta' ? 'border-amber-200' : ''}
                  ${notificacao.tipo === 'urgente' ? 'border-red-200' : ''}
                `}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bell className={`
                          h-5 w-5
                          ${notificacao.tipo === 'informacao' ? 'text-blue-600' : ''}
                          ${notificacao.tipo === 'alerta' ? 'text-amber-600' : ''}
                          ${notificacao.tipo === 'urgente' ? 'text-red-600' : ''}
                        `} />
                        {notificacao.titulo}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteNotificacao(notificacao.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                      </Button>
                    </div>
                    <CardDescription>
                      {formatDateTime(notificacao.data)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>{notificacao.mensagem}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
                <Bell className="h-10 w-10 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Não há notificações para exibir.</p>
              </div>
            )}
          </TabsContent>
          
          {/* Tab com resumo de DVPFs */}
          <TabsContent value="dvpf" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200">
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-amber-600" />
                  Resumo de DVPFs
                </CardTitle>
                <CardDescription>
                  Total de {resumoDVPF.count} DVPFs cadastradas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500">Últimas DVPFs cadastradas</h3>
                  <div className="space-y-2">
                    {resumoDVPF.ultimasDVPFs.map((dvpf) => (
                      <div key={dvpf.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div>
                          <p className="font-medium">{dvpf.numero}</p>
                          <p className="text-sm text-gray-500">
                            Cliente: {getClienteName(dvpf.cliente_id)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{formatDate(dvpf.data_emissao)}</p>
                          <p className="text-sm font-medium text-emerald-600">
                            {dvpf.volume_total?.toFixed(3) || 0} m³
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab com resumo de Entradas */}
          <TabsContent value="entrada" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                <CardTitle className="flex items-center">
                  <LogIn className="h-5 w-5 mr-2 text-purple-600" />
                  Resumo de Entradas
                </CardTitle>
                <CardDescription>
                  Total de {resumoEntrada.count} entradas com {resumoEntrada.volumeTotal.toFixed(3)} m³
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500">Últimas entradas cadastradas</h3>
                  <div className="space-y-2">
                    {resumoEntrada.ultimasEntradas.map((entrada) => (
                      <div key={entrada.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div>
                          <p className="font-medium">{entrada.numero_registro}</p>
                          <p className="text-sm text-gray-500">
                            Explorador: {getExplorador(entrada.explorador_id)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{formatDate(entrada.data)}</p>
                          <p className="text-sm font-medium text-emerald-600">
                            {entrada.volume_florestal_total?.toFixed(3) || 0} m³
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab com resumo de Saídas */}
          <TabsContent value="saida" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="bg-gradient-to-r from-rose-50 to-rose-100 border-b border-rose-200">
                <CardTitle className="flex items-center">
                  <LogOut className="h-5 w-5 mr-2 text-rose-600" />
                  Resumo de Saídas
                </CardTitle>
                <CardDescription>
                  Total de {resumoSaida.count} saídas com {resumoSaida.volumeTotal.toFixed(3)} m³
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500">Últimas saídas cadastradas</h3>
                  <div className="space-y-2">
                    {resumoSaida.ultimasSaidas.map((saida) => (
                      <div key={saida.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div>
                          <p className="font-medium">{saida.numero_registro}</p>
                          <div className="text-sm text-gray-500">
                            <p>Cliente: {saida.dvpf_id ? getClienteFromDVPF(saida.dvpf_id) : "N/A"}</p>
                            <p>Veículo: {getVeiculo(saida.veiculo_id).split(" - ")[0]}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{formatDate(saida.data)}</p>
                          <p className="text-sm font-medium text-emerald-600">
                            {saida.volume_comercial_total?.toFixed(3) || 0} m³
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
