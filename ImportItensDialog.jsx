
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';
import { Loader2, UploadCloud, AlertCircle, CheckCircle } from 'lucide-react';

// Função para calcular volume usando a fórmula específica do cliente
// Para volume florestal: ((D1+D2)/2)² * C * 0.00007854
// Para volume comercial: D² * C * 0.00007854 (onde D é o diâmetro efetivo)
const calcularVolume = (diametro1_cm, diametro2_cm, comprimento_m) => {
  const d1 = parseFloat(diametro1_cm);
  const d2 = parseFloat(diametro2_cm);
  const c = parseFloat(comprimento_m);
  const CONSTANT = 0.00007854; // 7854 / 100,000,000 (equivalente a PI/40000 para D em CM e C em M)

  if (isNaN(c) || c <= 0) {
      return 0;
  }

  let diametro_efetivo_cm;
  
  // Se ambos os diâmetros são válidos, faz a média (usado para volume florestal)
  if (!isNaN(d1) && !isNaN(d2) && d1 > 0 && d2 > 0) {
    diametro_efetivo_cm = (d1 + d2) / 2;
  }
  // Se apenas um diâmetro é válido, usa ele (usado para volume comercial, onde D1 e D2 da fórmula são o mesmo D_efetivo)
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
  return parseFloat(volume.toFixed(4)); // Retorna com 4 casas decimais para maior precisão interna
};

const ImportItensDialog = ({ isOpen, onClose, onImportSuccess, especiesList }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);

  console.log("[ImportItensDialog] Rendered. isOpen:", isOpen, "especiesList:", especiesList);

  // Limpar estados quando o diálogo for aberto
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setError(null);
      setLogs([]);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const addLog = (message, type = 'info') => {
    console.log(`[ImportItensDialog Log][${type}]: ${message}`);
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
    setLogs([]);
    setSuccessMessage(null);
  };

  const processImport = async () => {
    addLog("processImport iniciado");
    if (!file) {
      setError("Nenhum arquivo selecionado.");
      addLog("Nenhum arquivo selecionado.", "error");
      return;
    }

    if (!especiesList || !Array.isArray(especiesList)) {
        setError("A lista de espécies não está disponível. Não é possível importar itens.");
        addLog("Lista de espécies indisponível ou inválida.", "error");
        setLoading(false);
        return;
    }
    addLog(`Total de espécies carregadas no sistema: ${especiesList.length}`);


    setLoading(true);
    setError(null);
    setLogs([]); // Limpa logs antigos antes de uma nova tentativa
    setSuccessMessage(null);
    addLog(`Iniciando importação do arquivo: ${file.name}`);

    try {
      addLog("Fazendo upload do arquivo...");
      const uploadResult = await UploadFile({ file });
      if (!uploadResult || !uploadResult.file_url) {
        throw new Error("Falha no upload do arquivo. O resultado do upload não contém 'file_url'.");
      }
      addLog(`Upload concluído. URL: ${uploadResult.file_url}`, 'success');

      addLog("Extraindo dados do arquivo CSV...");
      // Cabeçalhos esperados: NumeroArvore, CodigoEspecie, Seccao, Diametro1_cm, Diametro2_cm, Comprimento1_m, Diametro3_cm, Comprimento2_m, IsDormente
      const extractionSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            NumeroArvore: { type: ["string", "number"] },
            CodigoEspecie: { type: "string" },
            Seccao: { type: "string" },
            Diametro1_cm: { type: ["string", "number"] },
            Diametro2_cm: { type: ["string", "number"] },
            Comprimento1_m: { type: ["string", "number"] },
            Diametro3_cm: { type: ["string", "number", "null"] }, 
            Comprimento2_m: { type: ["string", "number", "null"] }, 
            IsDormente: { type: ["string", "boolean", "number", "null"] }, 
          },
          required: ["NumeroArvore", "CodigoEspecie", "Seccao", "Diametro1_cm", "Diametro2_cm", "Comprimento1_m"]
        }
      };
      
      const extractionResult = await ExtractDataFromUploadedFile({
        file_url: uploadResult.file_url,
        json_schema: extractionSchema,
      });

      addLog(`Resultado da extração: Status: ${extractionResult.status}, Detalhes: ${extractionResult.details}`);

      if (extractionResult.status !== 'success' || !Array.isArray(extractionResult.output)) {
        throw new Error(`Falha na extração de dados: ${extractionResult.details || 'Formato de saída inesperado ou nenhum dado extraído.'}`);
      }
      addLog(`Extração de dados concluída. ${extractionResult.output.length} linhas encontradas.`, 'success');
      
      if (extractionResult.output.length === 0) {
        addLog("Nenhuma linha de dados encontrada no arquivo CSV após extração.", "warning");
        setError("O arquivo CSV parece estar vazio ou não contém dados nas colunas esperadas.");
        setLoading(false);
        return;
      }

      const importedItems = [];
      let processedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < extractionResult.output.length; i++) {
        const row = extractionResult.output[i];
        const rowIndexForLog = i + 1; 
        addLog(`Processando linha ${rowIndexForLog}: ${JSON.stringify(row)}`);
        try {
          // Validações e processamento de cada campo
          const numero_arvore_str = row.NumeroArvore ? String(row.NumeroArvore).trim() : "";
          if (!numero_arvore_str) throw new Error("Número da Árvore (NumeroArvore) está vazio ou ausente.");
          const numero_arvore_val = parseInt(numero_arvore_str, 10);
          if (isNaN(numero_arvore_val)) throw new Error(`Número da Árvore (NumeroArvore) inválido: '${row.NumeroArvore}'.`);

          const codigo_especie_csv = row.CodigoEspecie ? String(row.CodigoEspecie).trim().toUpperCase() : "";
          if (!codigo_especie_csv) throw new Error("Código da Espécie (CodigoEspecie) está vazio ou ausente.");
          
          const especieEncontrada = especiesList.find(esp => esp.codigo && esp.codigo.trim().toUpperCase() === codigo_especie_csv);
          if (!especieEncontrada) throw new Error(`Código da Espécie '${codigo_especie_csv}' (Coluna CodigoEspecie) não cadastrado no sistema.`);
          
          const seccao_csv = row.Seccao ? String(row.Seccao).trim().toUpperCase() : "";
          if (!seccao_csv || !/^[A-Z]$/.test(seccao_csv)) {
            throw new Error(`Seção '${row.Seccao}' (Coluna Seccao) inválida. Deve ser uma única letra (A-Z).`);
          }

          const d1_cm_str = row.Diametro1_cm ? String(row.Diametro1_cm).replace(',', '.') : "";
          const d2_cm_str = row.Diametro2_cm ? String(row.Diametro2_cm).replace(',', '.') : "";
          const c1_m_str = row.Comprimento1_m ? String(row.Comprimento1_m).replace(',', '.') : "";

          if (!d1_cm_str) throw new Error("Diâmetro 1 (Diametro1_cm) está vazio ou ausente.");
          if (!d2_cm_str) throw new Error("Diâmetro 2 (Diametro2_cm) está vazio ou ausente.");
          if (!c1_m_str) throw new Error("Comprimento 1 (Comprimento1_m) está vazio ou ausente.");

          const d1_cm = parseFloat(d1_cm_str);
          const d2_cm = parseFloat(d2_cm_str);
          const c1_m = parseFloat(c1_m_str);

          if (isNaN(d1_cm) || d1_cm <= 0) throw new Error(`Diâmetro 1 (Diametro1_cm) '${row.Diametro1_cm}' inválido.`);
          if (isNaN(d2_cm) || d2_cm <= 0) throw new Error(`Diâmetro 2 (Diametro2_cm) '${row.Diametro2_cm}' inválido.`);
          if (isNaN(c1_m) || c1_m <= 0) throw new Error(`Comprimento 1 (Comprimento1_m) '${row.Comprimento1_m}' inválido.`);

          const d3_cm_str_raw = row.Diametro3_cm ? String(row.Diametro3_cm).replace(',', '.') : null;
          const c2_m_str_raw = row.Comprimento2_m ? String(row.Comprimento2_m).replace(',', '.') : null;
          
          const d3_cm = d3_cm_str_raw ? parseFloat(d3_cm_str_raw) : null;
          const c2_m = c2_m_str_raw ? parseFloat(c2_m_str_raw) : null;

          if (d3_cm_str_raw && (isNaN(d3_cm) || d3_cm <= 0)) throw new Error(`Diâmetro 3 (Diametro3_cm) '${row.Diametro3_cm}' inválido se fornecido.`);
          if (c2_m_str_raw && (isNaN(c2_m) || c2_m <= 0)) throw new Error(`Comprimento 2 (Comprimento2_m) '${row.Comprimento2_m}' inválido se fornecido.`);
          
          // Volume Florestal: usa D1, D2 e C1
          const vol_flor = calcularVolume(d1_cm, d2_cm, c1_m);
          
          // Volume Comercial: usa diâmetro efetivo e comprimento efetivo
          let vol_com = 0;
          let diametro_efetivo = null;
          let comprimento_efetivo = null;

          // Determinar diâmetro efetivo (D3 tem prioridade, senão D2)
          if (d3_cm && d3_cm > 0) {
            diametro_efetivo = d3_cm;
          } else if (d2_cm && d2_cm > 0) {
            diametro_efetivo = d2_cm;
          }

          // Determinar comprimento efetivo (C2 tem prioridade, senão C1)
          if (c2_m && c2_m > 0) {
            comprimento_efetivo = c2_m;
          } else if (c1_m && c1_m > 0) {
            comprimento_efetivo = c1_m;
          }
          
          if (diametro_efetivo !== null && comprimento_efetivo !== null) {
            // Para volume comercial, o diâmetro efetivo é usado duas vezes na fórmula
            vol_com = calcularVolume(diametro_efetivo, diametro_efetivo, comprimento_efetivo);
          }
          
          let is_dormente_val = false;
          if (row.IsDormente !== null && row.IsDormente !== undefined && String(row.IsDormente).trim() !== "") {
            const dormenteVal = String(row.IsDormente).toLowerCase().trim();
            is_dormente_val = ["true", "sim", "1", "s", "verdadeiro"].includes(dormenteVal);
          }

          importedItems.push({
            numero_arvore: String(numero_arvore_val), // Garantir que é string
            seccao: seccao_csv,
            especie_id: especieEncontrada.id,
            especie_codigo: especieEncontrada.codigo, 
            especie_nome: especieEncontrada.nome, // Adicionado para possível uso no tempItems
            diametro1: String(d1_cm),
            diametro2: String(d2_cm),
            comprimento1: String(c1_m),
            volume_florestal: vol_flor.toFixed(3),
            diametro3: d3_cm ? String(d3_cm) : "",
            comprimento2: c2_m ? String(c2_m) : "",
            volume_comercial: vol_com.toFixed(3),
            is_dormente: is_dormente_val,
          });
          processedCount++;
          addLog(`Linha ${rowIndexForLog} processada com sucesso.`, 'success');
        } catch (itemError) {
          addLog(`Erro na linha ${rowIndexForLog} do CSV: ${itemError.message}`, 'error');
          console.error(`Erro processando linha ${rowIndexForLog}:`, itemError, "Dados da linha:", row);
          errorCount++;
        }
      }

      if (importedItems.length > 0) {
        addLog(`Chamando onImportSuccess com ${importedItems.length} itens.`);
        onImportSuccess(importedItems); // Chama a função callback passada por Entradas.js
        setSuccessMessage(`${processedCount} itens formatados e prontos para adicionar ao romaneio.`);
        addLog(`${processedCount} itens enviados para a página principal.`, 'success');
      }
      if (errorCount > 0) {
        setError(`${errorCount} linhas no CSV continham erros e não foram processadas. Verifique os logs.`);
      }
      if (importedItems.length === 0 && errorCount === 0 && extractionResult.output.length > 0) {
        setError("Nenhum item válido encontrado no CSV que pudesse ser processado ou todos os itens continham erros. Verifique o formato do arquivo e os logs.");
      }


    } catch (err) {
      console.error("[ImportItensDialog] Erro crítico na importação:", err);
      const displayError = err.message.includes("Unsupported file type") ? "Tipo de arquivo não suportado. Utilize .csv." : err.message;
      setError(`Erro na importação: ${displayError}`);
      addLog(`Erro crítico na importação: ${displayError}`, 'error');
    } finally {
      setLoading(false);
      addLog("processImport finalizado");
    }
  };
  
  const handleCloseDialog = () => {
    if (loading) return; 
    setFile(null);
    setError(null);
    setLogs([]);
    setSuccessMessage(null);
    onClose(); // Chama a função de fechar passada por Entradas.js
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UploadCloud className="h-5 w-5 mr-2 text-blue-600" />
            Importar Itens de CSV
          </DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV. Cabeçalhos esperados: NumeroArvore, CodigoEspecie, Seccao, Diametro1_cm, Diametro2_cm, Comprimento1_m, Diametro3_cm (opc), Comprimento2_m (opc), IsDormente (opc).
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="csv-file-itens-import">Arquivo CSV</Label>
            <Input 
              id="csv-file-itens-import" 
              type="file" 
              accept=".csv"
              onChange={handleFileChange} 
              className="mt-1"
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro na Importação</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && !error && (
             <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Pré-processamento Concluído</AlertTitle>
                <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
            </Alert>
          )}

          {logs.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-sm">Logs do Processamento:</h4>
              <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-md border text-xs space-y-1">
                {logs.map((log, index) => (
                  <p 
                    key={index} 
                    className={
                      log.type === 'error' ? 'text-red-600' : 
                      log.type === 'success' ? 'text-green-600' : 
                      log.type === 'warning' ? 'text-amber-600' :
                      'text-gray-700'
                    }
                  >
                    [{log.time}] {log.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={processImport} disabled={!file || loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {loading ? "Processando..." : "Importar e Validar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportItensDialog;
