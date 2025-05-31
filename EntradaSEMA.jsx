
import React, { useState, useEffect } from "react";
import { Entrada } from "@/api/entities";
import { EntradaItem } from "@/api/entities";
import { Especie } from "@/api/entities"; // Importar Especie
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Importar Input
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Importar Checkbox
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Search, AlertCircle, Info, Loader2, Filter } from "lucide-react"; // Adicionar Search, Info, Filter
import { format } from "date-fns";
import { generateSEMAExcel } from "@/api/functions";
import { generateSEMAcsv } from "@/api/functions";
import { generateSEMAcsvForAllEntradas } from "@/api/functions"; // Importar nova função
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


export default function EntradaSEMAPage() {
  const [entradas, setEntradas] = useState([]);
  const [entradaItens, setEntradaItens] = useState([]);
  const [todasEspecies, setTodasEspecies] = useState([]); // Estado para lista de espécies
  const [especiesSelecionadasFiltro, setEspeciesSelecionadasFiltro] = useState([]); // Estado para IDs de espécies selecionadas para filtro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntradaId, setSelectedEntradaId] = useState(null);
  const [selectedItens, setSelectedItens] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'error', message: string }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Ajustar Promise.all para carregar apenas as entidades necessárias
      const [fetchedEntradas, fetchedItens, fetchedEspecies] = await Promise.all([
        Entrada.list("-data"),
        EntradaItem.list(),
        Especie.list(), // Carregar espécies
      ]);
      setEntradas(fetchedEntradas);
      setEntradaItens(fetchedItens);
      setTodasEspecies(fetchedEspecies); // Armazenar espécies
    } catch (err) {
      console.error("Erro ao carregar dados para SEMA:", err);
      setError(`Falha ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleEntradaSelect = (entradaId) => {
    setSelectedEntradaId(entradaId);
    setSelectedItens(new Set()); // Limpar seleção de itens ao mudar de entrada
  };

  const handleSelectItem = (itemId) => {
    setSelectedItens(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      return newSelection;
    });
  };

  const handleSelectAllItensFromSelectedEntrada = () => {
    if (!selectedEntradaId) return;
    const itensDaEntrada = entradaItens.filter(item => item.entrada_id === selectedEntradaId);
    // Se todos já estão selecionados, desmarque todos. Senão, selecione todos.
    const allSelected = itensDaEntrada.length > 0 && itensDaEntrada.every(item => selectedItens.has(item.id));

    if (allSelected) {
        setSelectedItens(new Set());
    } else {
        const newSelection = new Set(itensDaEntrada.map(item => item.id));
        setSelectedItens(newSelection);
    }
  };
  
  const getEspecieNome = (especieId) => {
    const especie = todasEspecies.find(e => e.id === especieId);
    return especie ? `${especie.codigo} - ${especie.nome}` : 'Desconhecida';
  };

  const handleExportExcel = async () => {
    if (!selectedEntradaId) {
      setFeedbackMessage({ type: 'error', message: "Selecione uma entrada para exportar." });
      return;
    }
    setExporting(true);
    setFeedbackMessage(null);
    try {
      // Assuming generateSEMAExcel now returns { data, error }
      const { data, error: funcError } = await generateSEMAExcel({ entradaId: selectedEntradaId });
      if (funcError || !data) {
        throw new Error(funcError?.message || data?.error || "Falha ao gerar Excel.");
      }
      
      const entradaSelecionada = entradas.find(e => e.id === selectedEntradaId);
      const fileName = `SEMA_Entrada_${entradaSelecionada?.numero_registro || 'Desconhecida'}_${new Date().toISOString().split('T')[0]}.xlsx`;

      const blob = new Blob([new Uint8Array(data)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setFeedbackMessage({ type: 'success', message: `Arquivo Excel "${fileName}" gerado com sucesso.` });
    } catch (err) {
      console.error("Erro ao exportar para Excel SEMA:", err);
      setFeedbackMessage({ type: 'error', message: `Erro ao gerar Excel: ${err.message}` });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedEntradaId) {
      setFeedbackMessage({ type: 'error', message: "Selecione uma entrada para exportar." });
      return;
    }
    setExporting(true);
    setFeedbackMessage(null);
    try {
      // Assuming generateSEMAcsv now returns { data, error }
      const { data, error: funcError } = await generateSEMAcsv({ entradaId: selectedEntradaId });
       if (funcError || !data) {
        throw new Error(funcError?.message || data?.error || "Falha ao gerar CSV.");
      }

      const entradaSelecionada = entradas.find(e => e.id === selectedEntradaId);
      const fileName = `SEMA_Entrada_${entradaSelecionada?.numero_registro || 'Desconhecida'}_${new Date().toISOString().split('T')[0]}.csv`;
      
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setFeedbackMessage({ type: 'success', message: `Arquivo CSV "${fileName}" gerado com sucesso.` });
    } catch (err) {
      console.error("Erro ao exportar para CSV SEMA:", err);
      setFeedbackMessage({ type: 'error', message: `Erro ao gerar CSV: ${err.message}` });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAllSemaCsv = async () => {
    setExporting(true);
    setFeedbackMessage(null);
    try {
      // Passar os IDs das espécies selecionadas para o filtro
      const { data, error: funcError } = await generateSEMAcsvForAllEntradas({ especie_ids: especiesSelecionadasFiltro });
      if (funcError || !data) {
        throw new Error(funcError?.message || data?.error || "Falha ao gerar CSV de todos os itens.");
      }

      const dataAtual = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const fileName = `SEMA_TODOS_ITENS_${especiesSelecionadasFiltro.length > 0 ? 'FILTRADOS_' : ''}${dataAtual}.csv`;
      
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setFeedbackMessage({ type: 'success', message: `Arquivo CSV "${fileName}" gerado com sucesso.` });
    } catch (err) {
      console.error("Erro ao exportar todos os itens para CSV SEMA:", err);
      setFeedbackMessage({ type: 'error', message: `Erro ao gerar CSV de todos os itens: ${err.message}` });
    } finally {
      setExporting(false);
    }
  };

  // Handler para atualizar especiesSelecionadasFiltro
  const handleEspecieFiltroChange = (especieId) => {
    setEspeciesSelecionadasFiltro(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(especieId)) {
        newSelection.delete(especieId);
      } else {
        newSelection.add(especieId);
      }
      return Array.from(newSelection);
    });
  };


  const filteredEntradas = entradas.filter(entrada =>
    entrada.numero_registro.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const itensDaEntradaSelecionada = selectedEntradaId
    ? entradaItens.filter(item => item.entrada_id === selectedEntradaId)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="ml-2">Carregando dados...</p>
      </div>
    );
  }

  // Error alert only if initial data load fails
  if (error && !feedbackMessage) { // Ensure feedbackMessage does not override initial load error
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao Carregar</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exportação de Dados para SEMA</CardTitle>
          <CardDescription>
            Selecione uma entrada para visualizar seus itens e exportar os dados no formato SEMA (Excel ou CSV).
            Você também pode exportar todos os itens de todas as entradas de uma vez, com ou sem filtro de espécies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackMessage && (
            <Alert variant={feedbackMessage.type === 'error' ? 'destructive' : 'default'} className={`mb-4 ${feedbackMessage.type === 'success' ? 'bg-green-50 border-green-300 text-green-700' : ''}`}>
              {feedbackMessage.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              <AlertTitle>{feedbackMessage.type === 'error' ? 'Erro' : 'Sucesso'}</AlertTitle>
              <AlertDescription>{feedbackMessage.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Coluna de Entradas */}
            <div className="md:col-span-1 space-y-4">
              <Input
                type="text"
                placeholder="Buscar Nº Romaneio..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="mb-2"
              />
              <div className="border rounded-md max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-100">
                    <TableRow>
                      <TableHead>Nº Romaneio</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntradas.length > 0 ? filteredEntradas.map(entrada => (
                      <TableRow
                        key={entrada.id}
                        onClick={() => handleEntradaSelect(entrada.id)}
                        className={`cursor-pointer hover:bg-emerald-50 ${selectedEntradaId === entrada.id ? 'bg-emerald-100' : ''}`}
                      >
                        <TableCell>{entrada.numero_registro}</TableCell>
                        <TableCell>{format(new Date(entrada.data + 'T00:00:00'), "dd/MM/yyyy")}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={2} className="text-center">Nenhuma entrada encontrada.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Coluna de Itens da Entrada Selecionada */}
            <div className="md:col-span-2 space-y-4">
              {selectedEntradaId ? (
                <>
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      Itens do Romaneio: {entradas.find(e=>e.id === selectedEntradaId)?.numero_registro} ({itensDaEntradaSelecionada.length})
                    </h3>
                    <Button onClick={handleSelectAllItensFromSelectedEntrada} variant="outline" size="sm">
                        {itensDaEntradaSelecionada.length > 0 && itensDaEntradaSelecionada.every(item => selectedItens.has(item.id))
                            ? "Desmarcar Todos"
                            : "Marcar Todos os Itens"}
                    </Button>
                  </div>
                  <div className="border rounded-md max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-gray-100">
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Árvore</TableHead>
                          <TableHead>Seção</TableHead>
                          <TableHead>Espécie</TableHead>
                          <TableHead>D1 (cm)</TableHead>
                          <TableHead>D2 (cm)</TableHead>
                          <TableHead>Comp (m)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensDaEntradaSelecionada.length > 0 ? itensDaEntradaSelecionada.map(item => (
                          <TableRow key={item.id} className={`${selectedItens.has(item.id) ? 'bg-blue-50' : ''}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedItens.has(item.id)}
                                onCheckedChange={() => handleSelectItem(item.id)}
                              />
                            </TableCell>
                            <TableCell>{item.numero_arvore}</TableCell>
                            <TableCell>{item.seccao}</TableCell>
                            <TableCell>{getEspecieNome(item.especie_id)}</TableCell>
                            <TableCell>{item.diametro1}</TableCell>
                            <TableCell>{item.diametro2}</TableCell>
                            <TableCell>{item.comprimento1}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={7} className="text-center">Nenhum item nesta entrada.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-end">
                    <Button onClick={handleExportExcel} disabled={!selectedEntradaId || exporting} className="bg-green-600 hover:bg-green-700">
                      {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                      Baixar Selecionada (SEMA Excel)
                    </Button>
                    <Button onClick={handleExportCsv} disabled={!selectedEntradaId || exporting} className="bg-blue-600 hover:bg-blue-700">
                      {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                      Baixar Selecionada (SEMA CSV)
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] border rounded-md p-8 bg-gray-50">
                  <Info className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 text-center">Selecione uma entrada na lista à esquerda para ver seus itens e opções de exportação.</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Seção para Exportar Todos os Itens com Filtro de Espécie */}
          <Accordion type="single" collapsible className="w-full mt-8">
            <AccordionItem value="export-all">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center">
                  <Filter className="mr-2 h-5 w-5 text-emerald-700" />
                  Opções de Exportação Avançada: Todos os Itens
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <Card className="bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-md">Filtrar por Espécie(s) para Exportação Global</CardTitle>
                    <CardDescription>
                      Selecione as espécies que deseja incluir no arquivo CSV de todos os itens. Se nenhuma espécie for selecionada, todos os itens de todas as espécies serão exportados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-60 overflow-y-auto p-2 border rounded-md">
                      {todasEspecies.map(especie => (
                        <div key={especie.id} className="flex items-center space-x-2 p-1 rounded hover:bg-slate-100 transition-colors">
                          <Checkbox
                            id={`especie-filtro-${especie.id}`}
                            checked={especiesSelecionadasFiltro.includes(especie.id)}
                            onCheckedChange={() => handleEspecieFiltroChange(especie.id)}
                          />
                          <Label htmlFor={`especie-filtro-${especie.id}`} className="text-sm cursor-pointer">
                            {especie.codigo} - {especie.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleExportAllSemaCsv} disabled={exporting} className="w-full bg-emerald-700 hover:bg-emerald-800">
                      {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                      Baixar Todos os Itens {especiesSelecionadasFiltro.length > 0 ? `(${especiesSelecionadasFiltro.length} Esp.) ` : ''}(SEMA CSV)
                    </Button>
                     {especiesSelecionadasFiltro.length > 0 && (
                        <Button variant="link" onClick={() => setEspeciesSelecionadasFiltro([])} className="text-xs mt-1">
                            Limpar seleção de espécies
                        </Button>
                    )}
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

        </CardContent>
      </Card>
    </div>
  );
}
