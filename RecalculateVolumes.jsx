
import React, { useState } from "react";
import { Entrada } from "@/api/entities";
import { EntradaItem } from "@/api/entities";
import { Saida } from "@/api/entities";
import { SaidaItem } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Função para calcular volume usando a fórmula específica do cliente
// Para volume florestal: ((D1+D2)/2)² * C * 0.00007854
// Para volume comercial: D² * C * 0.00007854 (onde D é o diâmetro efetivo)
const calcularVolume = (diametro1_cm, diametro2_cm, comprimento_m) => {
  const d1 = parseFloat(diametro1_cm);
  const d2 = parseFloat(diametro2_cm);
  const c = parseFloat(comprimento_m);
  const CONSTANT = 0.00007854; // 7854 / 100,000,000

  if (isNaN(c) || c <= 0) {
      return 0;
  }

  let diametro_efetivo_cm;
  
  // Se ambos os diâmetros são válidos, faz a média (volume florestal)
  if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
    diametro_efetivo_cm = (d1 + d2) / 2;
  }
  // Se apenas um diâmetro é válido, usa ele (volume comercial)
  else if (!isNaN(d1) && d1 > 0) {
    diametro_efetivo_cm = d1;
  }
  else if (!isNaN(d2) && d2 > 0) {
    diametro_efetivo_cm = d2;
  }
  else {
    return 0; // Nenhum diâmetro válido
  }

  const volume = (diametro_efetivo_cm * diametro_efetivo_cm) * c * CONSTANT;
  return parseFloat(volume.toFixed(4));
};

export default function RecalculateVolumesPage() {
  const [status, setStatus] = useState("idle"); // idle, processing, success, error
  const [logs, setLogs] = useState([]);
  const [errorDetails, setErrorDetails] = useState("");
  const [progress, setProgress] = useState({
    entradaItems: 0,
    saidaItems: 0,
    entradas: 0,
    saidas: 0,
    totalSteps: 0,
    currentStep: 0,
  });

  const addLog = (message, type = "info") => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const updateProgress = (step, total, section) => {
    setProgress((prev) => ({
      ...prev,
      currentStep: prev.currentStep + 1,
      totalSteps: total,
      [section]: step,
    }));
  };

  const handleRecalculate = async () => {
    if (status === "processing") return;

    setStatus("processing");
    setLogs([]);
    setErrorDetails("");
    setProgress({ entradaItems: 0, saidaItems: 0, entradas: 0, saidas: 0, totalSteps: 0, currentStep: 0 });
    addLog("Iniciando recálculo de volumes com novas fórmulas...", "info");

    try {
      // 1. Recalcular e Atualizar EntradaItems
      addLog("Buscando todos os itens de entrada...", "info");
      const entradaItems = await EntradaItem.list();
      addLog(`Encontrados ${entradaItems.length} itens de entrada.`, "info");
      
      const updatedEntradaItemsMap = new Map();

      for (let i = 0; i < entradaItems.length; i++) {
        const item = entradaItems[i];
        
        const d1_val = parseFloat(item.diametro1);
        const d2_val = parseFloat(item.diametro2);
        const c1_val = parseFloat(item.comprimento1);
        const d3_val = parseFloat(item.diametro3);
        const c2_val = parseFloat(item.comprimento2);

        // Recalcular Volume Florestal: usa D1, D2 e C1
        let new_volume_florestal = 0;
        if (!isNaN(d1_val) && !isNaN(d2_val) && !isNaN(c1_val) && d1_val > 0 && d2_val > 0 && c1_val > 0) {
            new_volume_florestal = calcularVolume(d1_val, d2_val, c1_val);
        }

        // Recalcular Volume Comercial: usa diâmetro efetivo e comprimento efetivo
        let new_volume_comercial = 0;
        let diametro_efetivo = null;
        let comprimento_efetivo = null;

        // Determinar diâmetro efetivo (D3 tem prioridade, senão D2)
        if (!isNaN(d3_val) && d3_val > 0) {
          diametro_efetivo = d3_val;
        } else if (!isNaN(d2_val) && d2_val > 0) {
          diametro_efetivo = d2_val;
        }

        // Determinar comprimento efetivo (C2 tem prioridade, senão C1)
        if (!isNaN(c2_val) && c2_val > 0) {
          comprimento_efetivo = c2_val;
        } else if (!isNaN(c1_val) && c1_val > 0) {
          comprimento_efetivo = c1_val;
        }
        
        if (diametro_efetivo !== null && comprimento_efetivo !== null) {
          new_volume_comercial = calcularVolume(diametro_efetivo, diametro_efetivo, comprimento_efetivo);
        }

        const updates = {
          volume_florestal: new_volume_florestal,
          volume_comercial: new_volume_comercial,
        };

        const currentVolFlor = parseFloat(item.volume_florestal || 0);
        const currentVolCom = parseFloat(item.volume_comercial || 0);
        
        if (Math.abs(updates.volume_florestal - currentVolFlor) > 0.00001 || Math.abs(updates.volume_comercial - currentVolCom) > 0.00001) {
          try {
            await EntradaItem.update(item.id, updates);
            updatedEntradaItemsMap.set(item.id, { ...item, ...updates });
            addLog(`Item ${item.numero_arvore}${item.seccao} atualizado: Vol.Flor ${currentVolFlor.toFixed(4)} → ${updates.volume_florestal.toFixed(4)}, Vol.Com ${currentVolCom.toFixed(4)} → ${updates.volume_comercial.toFixed(4)}`, "success");
          } catch (e) {
            addLog(`Erro ao atualizar EntradaItem ${item.id}: ${e.message}`, "error");
          }
        } else {
            updatedEntradaItemsMap.set(item.id, item);
        }
        updateProgress(i + 1, entradaItems.length, "entradaItems");
      }
      addLog("Recálculo e atualização de itens de entrada concluídos.", "success");

      // 2. Recalcular e Atualizar SaidaItems
      addLog("Buscando todos os itens de saída...", "info");
      const saidaItems = await SaidaItem.list();
      addLog(`Encontrados ${saidaItems.length} itens de saída.`, "info");

      for (let i = 0; i < saidaItems.length; i++) {
        const item = saidaItems[i];
        const correspondingEntradaItem = updatedEntradaItemsMap.get(item.entrada_item_id);

        if (correspondingEntradaItem) {
          const updates = {
            volume_florestal: correspondingEntradaItem.volume_florestal,
            volume_comercial: correspondingEntradaItem.volume_comercial,
          };

          const currentVolFlor = parseFloat(item.volume_florestal || 0);
          const currentVolCom = parseFloat(item.volume_comercial || 0);

          if (Math.abs(updates.volume_florestal - currentVolFlor) > 0.00001 || Math.abs(updates.volume_comercial - currentVolCom) > 0.00001) {
            try {
              await SaidaItem.update(item.id, updates);
              addLog(`SaidaItem ${item.numero_arvore}${item.seccao} atualizado com volumes da entrada`, "success");
            } catch (e) {
              addLog(`Erro ao atualizar SaidaItem ${item.id}: ${e.message}`, "error");
            }
          }
        } else {
          addLog(`SaidaItem ${item.id} (${item.numero_arvore}/${item.seccao}) referencia um EntradaItem (${item.entrada_item_id}) não encontrado.`, "warning");
        }
        updateProgress(i + 1, saidaItems.length, "saidaItems");
      }
      addLog("Recálculo e atualização de itens de saída concluídos.", "success");

      // 3. Atualizar totais das Entradas
      addLog("Atualizando totais das Entradas...", "info");
      const entradas = await Entrada.list();
      addLog(`Encontradas ${entradas.length} Entradas.`, "info");
      
      const allUpdatedEntradaItems = await EntradaItem.list(); // Buscar novamente para garantir dados mais recentes
      const entradaItemsByEntradaId = allUpdatedEntradaItems.reduce((acc, item) => {
          if (!acc[item.entrada_id]) {
              acc[item.entrada_id] = [];
          }
          acc[item.entrada_id].push(item);
          return acc;
      }, {});

      for (let i = 0; i < entradas.length; i++) {
        const entrada = entradas[i];
        const itemsForThisEntrada = entradaItemsByEntradaId[entrada.id] || [];
        
        const new_total_florestal = itemsForThisEntrada.reduce((sum, item) => sum + parseFloat(item.volume_florestal || 0), 0);
        const new_total_comercial = itemsForThisEntrada.reduce((sum, item) => sum + parseFloat(item.volume_comercial || 0), 0);

        const updates = {
          volume_florestal_total: parseFloat(new_total_florestal.toFixed(4)), // Garantir 4 casas no total
          volume_comercial_total: parseFloat(new_total_comercial.toFixed(4)), // Garantir 4 casas no total
        };

        const currentTotalFlor = parseFloat(entrada.volume_florestal_total || 0);
        const currentTotalCom = parseFloat(entrada.volume_comercial_total || 0);

        if (Math.abs(updates.volume_florestal_total - currentTotalFlor) > 0.00001 || Math.abs(updates.volume_comercial_total - currentTotalCom) > 0.00001) {
          try {
            await Entrada.update(entrada.id, updates);
            addLog(`Entrada ${entrada.numero_registro} totais atualizados`, "success");
          } catch (e) {
            addLog(`Erro ao atualizar total da Entrada ${entrada.id}: ${e.message}`, "error");
          }
        }
        updateProgress(i + 1, entradas.length, "entradas");
      }
      addLog("Atualização dos totais das Entradas concluída.", "success");

      // 4. Atualizar totais das Saídas
      addLog("Atualizando totais das Saídas...", "info");
      const saidas = await Saida.list();
      addLog(`Encontradas ${saidas.length} Saídas.`, "info");

      const allUpdatedSaidaItems = await SaidaItem.list(); // Buscar novamente
      const saidaItemsBySaidaId = allUpdatedSaidaItems.reduce((acc, item) => {
          if (!acc[item.saida_id]) {
              acc[item.saida_id] = [];
          }
          acc[item.saida_id].push(item);
          return acc;
      }, {});

      for (let i = 0; i < saidas.length; i++) {
        const saida = saidas[i];
        const itemsForThisSaida = saidaItemsBySaidaId[saida.id] || [];

        const new_total_florestal = itemsForThisSaida.reduce((sum, item) => sum + parseFloat(item.volume_florestal || 0), 0);
        const new_total_comercial = itemsForThisSaida.reduce((sum, item) => sum + parseFloat(item.volume_comercial || 0), 0);

        const updates = {
          volume_florestal_total: parseFloat(new_total_florestal.toFixed(4)), // Garantir 4 casas
          volume_comercial_total: parseFloat(new_total_comercial.toFixed(4)), // Garantir 4 casas
        };

        const currentTotalFlor = parseFloat(saida.volume_florestal_total || 0);
        const currentTotalCom = parseFloat(saida.volume_comercial_total || 0);

        if (Math.abs(updates.volume_florestal_total - currentTotalFlor) > 0.00001 || Math.abs(updates.volume_comercial_total - currentTotalCom) > 0.00001) {
          try {
            await Saida.update(saida.id, updates);
            addLog(`Saída ${saida.numero_registro} totais atualizados`, "success");
          } catch (e) {
            addLog(`Erro ao atualizar total da Saída ${saida.id}: ${e.message}`, "error");
          }
        }
        updateProgress(i + 1, saidas.length, "saidas");
      }
      addLog("Atualização dos totais das Saídas concluída.", "success");

      setStatus("success");
      addLog("TODOS OS VOLUMES FORAM RECALCULADOS COM SUCESSO USANDO 4 CASAS DECIMAIS!", "success");
      addLog("Os volumes agora devem estar consistentes com os requisitos da SEMA.", "success");

    } catch (error) {
      setStatus("error");
      setErrorDetails(`Erro geral durante o processo: ${error.message}. Verifique os logs acima.`);
      addLog(`Processo interrompido devido a um erro: ${error.message}`, "error");
      console.error("Erro no recalcular volumes:", error);
    }
  };

  const getProgressMessage = () => {
    if (status === "idle") return "Pronto para iniciar o recálculo com as novas fórmulas.";
    if (status === "success") return "Recálculo de volumes concluído com sucesso!";
    if (status === "error") return "Recálculo de volumes falhou. Verifique os logs.";

    const total = progress.totalSteps;
    const current = progress.currentStep;
    const percentage = total > 0 ? ((current / total) * 100).toFixed(0) : 0;

    let sectionMessage = "";
    if (progress.entradaItems > 0 && progress.entradaItems <= progress.totalSteps) sectionMessage = `Itens de Entrada: ${progress.entradaItems}`;
    else if (progress.saidaItems > 0 && progress.saidaItems <= progress.totalSteps) sectionMessage = `Itens de Saída: ${progress.saidaItems}`;
    else if (progress.entradas > 0 && progress.entradas <= progress.totalSteps) sectionMessage = `Entradas: ${progress.entradas}`;
    else if (progress.saidas > 0 && progress.saidas <= progress.totalSteps) sectionMessage = `Saídas: ${progress.saidas}`;

    return `Processando... ${percentage}% - ${sectionMessage}`;
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <RefreshCw className="h-6 w-6 mr-2 text-emerald-600" /> Recálculo de Volumes
          </CardTitle>
          <p className="text-gray-600">
            Esta ferramenta irá recalcular todos os volumes florestais e comerciais usando as fórmulas corretas:
          </p>
          <div className="bg-blue-50 p-4 rounded-md mt-4">
            <h4 className="font-semibold text-blue-800">Fórmulas Aplicadas:</h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li><strong>Volume Florestal:</strong> ((D1+D2)/2)² × C1 × 0.00007854</li>
              <li><strong>Volume Comercial:</strong> D_efetivo² × C_efetivo × 0.00007854</li>
              <li className="text-xs">Onde D_efetivo = D3 (se disponível) ou D2, e C_efetivo = C2 (se disponível) ou C1</li>
            </ul>
          </div>
          <Alert className="mt-4 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">ATENÇÃO:</AlertTitle>
            <AlertDescription className="text-red-700">
              Este processo é irreversível e irá atualizar todos os volumes no banco de dados.
              Não feche o navegador durante a operação.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro no Recálculo</AlertTitle>
                <AlertDescription>{errorDetails}</AlertDescription>
              </Alert>
            )}
            {status === "success" && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Sucesso!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Todos os volumes foram recalculados com as novas fórmulas e agora devem bater com os PDFs de referência.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleRecalculate}
              disabled={status === "processing"}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {status === "processing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {getProgressMessage()}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Iniciar Recálculo de Volumes
                </>
              )}
            </Button>

            <div className="mt-4">
              <h3 className="font-medium mb-2">Logs do Processo:</h3>
              <div className="bg-gray-100 p-3 rounded-md max-h-80 overflow-y-auto text-sm">
                {logs.length === 0 && <p className="text-gray-500">Nenhum log ainda.</p>}
                {logs.map((log, index) => (
                  <p key={index} className={`
                    ${log.type === "info" ? "text-gray-700" : ""}
                    ${log.type === "success" ? "text-green-700 font-medium" : ""}
                    ${log.type === "error" ? "text-red-700 font-medium" : ""}
                    ${log.type === "warning" ? "text-amber-700" : ""}
                  `}>
                    [{log.timestamp}] {log.message}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
