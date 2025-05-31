
import React, { useState, useEffect } from "react";
// Corrigindo importações de entidades
import { Especie } from "@/api/entities"; 
import { Entrada } from "@/api/entities"; // Adicionar import da Entidade Entrada
import { EntradaItem } from "@/api/entities";
import { SaidaItem } from "@/api/entities";
// Se precisar de mais entidades no futuro, adicione-as individualmente aqui
// Ex: import { Cliente } from "@/api/entities";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Filter, RotateCcw, Loader2, Pencil, AlertCircle, Save, XCircle, CheckSquare, Square, CheckCircle, SearchX, AlertTriangle, Printer, Trash2, Download } from "lucide-react"; // Adicionado Download e Trash2
import { Input } from "@/components/ui/input";
// Removido Link e createPageUrl pois a edição será em linha
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adicionado Alert
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Adicionado AlertDialog

import { generateFilteredEntradaItensReportPDF } from "@/api/functions"; // Nova função
import { generateSecaoUnicaReportPDF } from "@/api/functions"; // Nova função importada


const RELATORIO_TYPES = {
  ESTOQUE_ATUAL_POR_ESPECIE: "ESTOQUE_ATUAL_POR_ESPECIE",
  FILTRAR_ITENS_DE_ENTRADA: "FILTRAR_ITENS_DE_ENTRADA", 
  VERIFICAR_NUMEROS_AUSENTES: "VERIFICAR_NUMEROS_AUSENTES", 
  VERIFICAR_ARVORES_DUPLICADAS: "VERIFICAR_ARVORES_DUPLICADAS", 
  VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO: "VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO", // Novo tipo
  VERIFICAR_ARVORES_COM_SECAO_UNICA: "VERIFICAR_ARVORES_COM_SECAO_UNICA", // Novo tipo
  // Futuramente: MOVIMENTACAO_PERIODO, ROMANEIO_ENTRADA_DETALHADO, etc.
};

// Função para calcular volume usando a fórmula específica do cliente
// Para volume florestal: ((D1+D2)/2)² * C * 0.00007854
// Para volume comercial: D² * C * 0.00007854 (where D is the effective diameter)
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

const ALL_SPECIES_VALUE = "__ALL__";


export default function RelatoriosPage() {
  const [reportType, setReportType] = useState(RELATORIO_TYPES.ESTOQUE_ATUAL_POR_ESPECIE);
  const [filters, setFilters] = useState({
    especie_id: ALL_SPECIES_VALUE,
    seccao_filtro: "", 
    diametro1_filtro: "",
    diametro2_filtro: "",
    comprimento1_filtro: "",
    diametro3_filtro: "",
    comprimento2_filtro: "",
    numero_arvore_filtro: "", // Novo filtro para número da árvore
    intervalo_inicio_filtro: "", // Novo filtro para relatório de números ausentes
    intervalo_fim_filtro: "",   // Novo filtro para relatório de números ausentes
    intervalo_inicio_inconsistencia_filtro: "", // Novo para "Verificar Inconsistência Espécie/Seção"
    intervalo_fim_inconsistencia_filtro: "",   // Novo para "Verificar Inconsistência Espécie/Seção"
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false); // Loading para geração do relatório
  const [initialLoading, setInitialLoading] = useState(true); // Loading para dados iniciais (espécies)
  const [especies, setEspecies] = useState([]);
  const [pageError, setPageError] = useState(null); // Estado para erros da página
  const [feedback, setFeedback] = useState(null); // Para mensagens de sucesso/erro da edição em linha

  // Estados para edição em linha
  const [editingItemId, setEditingItemId] = useState(null); // ID do EntradaItem sendo editado
  const [editingItemData, setEditingItemData] = useState(null); // Dados do item em edição
  const [editLoading, setEditLoading] = useState(false); // Loading para salvar a edição da linha

  // Novos estados para exclusão
  const [itemToDelete, setItemToDelete] = useState(null); // Item selecionado para exclusão
  const [showDeleteDialog, setShowDeleteDialog] = useState(false); // Controla visibilidade do diálogo de confirmação
  const [isDeletingItem, setIsDeletingItem] = useState(false); // Loading para a ação de deletar no modal
  const [deleteActionLoadingItemId, setDeleteActionLoadingItemId] = useState(null); // Loading para o botão de lixeira na linha

  // Novos estados para seleção em lote
  const [selectedItems, setSelectedItems] = useState(new Set()); // IDs dos itens selecionados
  const [selectAll, setSelectAll] = useState(false); // Estado do checkbox "selecionar todos"

  const [generatingPDF, setGeneratingPDF] = useState(false); // Novo estado para o PDF


  useEffect(() => {
    async function loadInitialData() {
      if (especies.length === 0) { // Carrega apenas se não tiver sido carregado antes
        setInitialLoading(true);
        setPageError(null);
        try {
          const especiesData = await Especie.list();
          setEspecies(especiesData);
        } catch (error) {
          console.error("Erro ao carregar espécies para filtros:", error);
          if (error.message && error.message.toLowerCase().includes("network error")) {
            setPageError("Erro de rede ao carregar espécies. Verifique sua conexão e tente novamente.");
          } else if (error.response && error.response.status === 429) {
            setPageError("Muitas solicitações ao servidor ao carregar espécies. Tente novamente em alguns minutos.");
          } else {
            setPageError("Erro ao carregar lista de espécies.");
          }
        } finally {
          setInitialLoading(false);
        }
      } else {
        setInitialLoading(false); // Já carregado, então não há loading inicial
      }
    }
    loadInitialData();
  }, []); // Dependência vazia para carregar uma vez

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setFeedback(null); // Limpar feedback ao mudar filtros
  };

  const resetFilters = () => {
    setFilters({
      especie_id: ALL_SPECIES_VALUE,
      seccao_filtro: "",
      diametro1_filtro: "",
      diametro2_filtro: "",
      comprimento1_filtro: "",
      diametro3_filtro: "",
      comprimento2_filtro: "",
      numero_arvore_filtro: "", // Resetar novo filtro
      intervalo_inicio_filtro: "", // Resetar novo filtro
      intervalo_fim_filtro: "",   // Resetar novo filtro
      intervalo_inicio_inconsistencia_filtro: "", // Resetar novo filtro
      intervalo_fim_inconsistencia_filtro: "",   // Resetar novo filtro
    });
    setReportData(null);
    setFeedback(null);
    setEditingItemId(null); // Cancelar edição se houver
    setEditingItemData(null); // Limpar dados de edição
    setPageError(null); // Limpar erros da página
    clearSelections(); // Limpar seleções
  };
  
  const formatarNumero = (num, casasDecimais = 4) => { // Alterado o default para 4 casas decimais
    let valor = parseFloat(num);
    if (typeof valor !== 'number' || isNaN(valor)) return Number(0).toFixed(casasDecimais);
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: casasDecimais, maximumFractionDigits: casasDecimais });
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData(null);
    setFeedback(null);
    setEditingItemId(null); // Cancelar qualquer edição em linha ao gerar novo relatório
    setEditingItemData(null); // Limpar dados de edição
    setPageError(null); // Limpar erros anteriores
    clearSelections(); // Limpar seleções ao gerar novo relatório
    console.log(`[RelatoriosPage] Gerando relatório tipo: ${reportType}`, filters);

    try {
      let data = [];
      // Tentativa de carregar espécies aqui também, caso não tenham sido carregadas inicialmente
      const todasEspeciesLocal = especies && especies.length > 0 
        ? especies 
        : (await Especie.list().catch(e => { 
            console.error("Erro ao listar Especie em generateReport:", e); 
            throw e; // Re-lança o erro para ser pego pelo catch principal
          }));
      
      if (reportType === RELATORIO_TYPES.ESTOQUE_ATUAL_POR_ESPECIE) {
        const todasEntradasItens = await EntradaItem.list().catch(e => { 
            console.error("Erro ao listar EntradaItem em ESTOQUE_ATUAL_POR_ESPECIE:", e); 
            throw e;
        });
        const todasSaidasItens = await SaidaItem.list().catch(e => { 
            console.error("Erro ao listar SaidaItem em ESTOQUE_ATUAL_POR_ESPECIE:", e); 
            throw e;
        });

        const estoquePorEspecie = {};

        todasEntradasItens.forEach(item => {
          if (!item || !item.especie_id) return;
          // Aplicar filtro de espécie se selecionado
          if (filters.especie_id !== ALL_SPECIES_VALUE && item.especie_id !== filters.especie_id) return;

          estoquePorEspecie[item.especie_id] = (estoquePorEspecie[item.especie_id] || 0) + (parseFloat(item.volume_comercial) || 0);
        });

        todasSaidasItens.forEach(item => {
          if (!item || !item.especie_id) return;
          // Aplicar filtro de espécie se selecionado
          if (filters.especie_id !== ALL_SPECIES_VALUE && item.especie_id !== filters.especie_id) return;
          
          estoquePorEspecie[item.especie_id] = (estoquePorEspecie[item.especie_id] || 0) - (parseFloat(item.volume_comercial) || 0);
        });
        
        data = Object.keys(estoquePorEspecie).map(especieId => {
          const especieInfo = todasEspeciesLocal.find(e => e.id === especieId);
          return {
            id: especieId,
            nomeEspecie: especieInfo ? `${especieInfo.codigo || 'SC'} - ${especieInfo.nome}` : `Desconhecida (ID: ${especieId})`,
            volume: estoquePorEspecie[especieId]
          };
        }).sort((a,b) => b.volume - a.volume); // Ordenar por maior volume

      } else if (reportType === RELATORIO_TYPES.FILTRAR_ITENS_DE_ENTRADA) {
        // Carregar todas as entradas para obter o número do romaneio
        const [todosItensEntradaDb, todasEntradasDb] = await Promise.all([
          EntradaItem.list().catch(e => { console.error("Erro ao listar EntradaItem em FILTRAR_ITENS_DE_ENTRADA:", e); throw e; }),
          Entrada.list().catch(e => { console.error("Erro ao listar Entrada em FILTRAR_ITENS_DE_ENTRADA:", e); throw e; })
        ]);

        let todosItensEntrada = todosItensEntradaDb;

        // Aplicar filtros
        if (filters.numero_arvore_filtro) {
          todosItensEntrada = todosItensEntrada.filter(item => 
            String(item.numero_arvore) === String(filters.numero_arvore_filtro)
          );
        }
        if (filters.especie_id !== ALL_SPECIES_VALUE) {
          todosItensEntrada = todosItensEntrada.filter(item => item.especie_id === filters.especie_id);
        }
        if (filters.seccao_filtro) {
          todosItensEntrada = todosItensEntrada.filter(item => item.seccao?.toUpperCase() === filters.seccao_filtro.toUpperCase());
        }
        const parseFilterFloat = (val) => {
          if (val === null || val === undefined || String(val).trim() === '') return null;
          const parsed = parseFloat(String(val).replace(",", "."));
          return isNaN(parsed) ? null : parsed;
        };

        const d1Filtro = parseFilterFloat(filters.diametro1_filtro);
        if (d1Filtro !== null) {
            todosItensEntrada = todosItensEntrada.filter(item => parseFloat(item.diametro1) === d1Filtro);
        }
        const d2Filtro = parseFilterFloat(filters.diametro2_filtro);
        if (d2Filtro !== null) {
            todosItensEntrada = todosItensEntrada.filter(item => parseFloat(item.diametro2) === d2Filtro);
        }
        const c1Filtro = parseFilterFloat(filters.comprimento1_filtro);
        if (c1Filtro !== null) {
            todosItensEntrada = todosItensEntrada.filter(item => parseFloat(item.comprimento1) === c1Filtro);
        }
        const d3Filtro = parseFilterFloat(filters.diametro3_filtro);
        if (d3Filtro !== null) {
            todosItensEntrada = todosItensEntrada.filter(item => parseFloat(item.diametro3) === d3Filtro);
        } else if (filters.diametro3_filtro !== null && filters.diametro3_filtro.trim() !== '') { 
             todosItensEntrada = []; // Se o filtro tem valor, mas é inválido/não-numérico, não deve retornar nada
        }

        const c2Filtro = parseFilterFloat(filters.comprimento2_filtro);
        if (c2Filtro !== null) {
            todosItensEntrada = todosItensEntrada.filter(item => parseFloat(item.comprimento2) === c2Filtro);
        } else if (filters.comprimento2_filtro !== null && filters.comprimento2_filtro.trim() !== '') {
             todosItensEntrada = []; // Se o filtro tem valor, mas é inválido/não-numérico, não deve retornar nada
        }
        
        data = todosItensEntrada.map(item => {
          const especieInfo = todasEspeciesLocal.find(e => e.id === item.especie_id);
          const entradaInfo = todasEntradasDb.find(ent => ent.id === item.entrada_id); // Encontrar a entrada
          return {
            ...item, // Importante manter o item original para ter acesso ao entrada_id
            id: item.id, // Garantir que o ID do EntradaItem está aqui
            nomeEspecie: especieInfo ? `${especieInfo.codigo || 'SC'} - ${especieInfo.nome}` : `Desconhecida (ID: ${item.especie_id})`,
            numero_romaneio: entradaInfo ? entradaInfo.id_externo || entradaInfo.numero_registro : "N/A", // Adicionar número do romaneio
          };
        }).sort((a,b) => (a.numero_arvore || 0) - (b.numero_arvore || 0) || a.seccao?.localeCompare(b.seccao || ''));
      
      } else if (reportType === RELATORIO_TYPES.VERIFICAR_NUMEROS_AUSENTES) {
        const inicio = parseInt(filters.intervalo_inicio_filtro, 10);
        const fim = parseInt(filters.intervalo_fim_filtro, 10);

        if (isNaN(inicio) || isNaN(fim) || inicio <= 0 || fim <= 0 || inicio > fim) {
          setPageError("Intervalo inválido. Verifique os números de início e fim. Ambos devem ser números inteiros maiores que zero, e o número inicial não pode ser maior que o final.");
          setLoading(false);
          return;
        }

        let itensEntradaParaVerificacao = await EntradaItem.list().catch(e => { console.error("Erro ao listar EntradaItem para verificação de ausentes:", e); throw e; });
        
        if (filters.especie_id !== ALL_SPECIES_VALUE) {
          itensEntradaParaVerificacao = itensEntradaParaVerificacao.filter(item => item.especie_id === filters.especie_id);
        }

        const numerosArvoreExistentes = new Set(
          itensEntradaParaVerificacao.map(item => parseInt(item.numero_arvore, 10))
        );
        
        const numerosAusentes = [];
        for (let i = inicio; i <= fim; i++) {
          if (!numerosArvoreExistentes.has(i)) {
            numerosAusentes.push({ id: `ausente_${i}`, numero: i }); // Usar um ID único para cada item
          }
        }
        data = numerosAusentes;

      } else if (reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_DUPLICADAS) {
        // Carregar todas as entradas para obter o número do romaneio
        const [todosItensEntradaDb, todasEntradasDb] = await Promise.all([
          EntradaItem.list().catch(e => { console.error("Erro ao listar EntradaItem para verificação de duplicadas:", e); throw e; }),
          Entrada.list().catch(e => { console.error("Erro ao listar Entrada para verificação de duplicadas:", e); throw e; })
        ]);

        let itensParaVerificacao = todosItensEntradaDb;
        
        // Aplicar filtro de espécie se selecionado
        if (filters.especie_id !== ALL_SPECIES_VALUE) {
          itensParaVerificacao = itensParaVerificacao.filter(item => item.especie_id === filters.especie_id);
        }

        // Criar um mapa para agrupar por número da árvore + seção
        const gruposPorArvoreSecao = {};
        
        itensParaVerificacao.forEach(item => {
          const chave = `${item.numero_arvore}_${item.seccao?.toUpperCase() || ''}`;
          if (!gruposPorArvoreSecao[chave]) {
            gruposPorArvoreSecao[chave] = [];
          }
          gruposPorArvoreSecao[chave].push(item);
        });

        // Filtrar apenas os grupos que têm mais de 1 item (duplicados)
        const arvoresDuplicadas = [];
        Object.entries(gruposPorArvoreSecao).forEach(([chave, itens]) => {
          if (itens.length > 1) {
            // Para cada grupo de duplicados, adicionar todos os itens à lista de resultados
            itens.forEach((item, index) => {
              const especieInfo = todasEspeciesLocal.find(e => e.id === item.especie_id);
              const entradaInfo = todasEntradasDb.find(ent => ent.id === item.entrada_id);
              
              arvoresDuplicadas.push({
                ...item,
                id: `${item.id}_dup_${index}`, // ID único para renderização
                item_id_original: item.id, // Manter ID original para edição
                nomeEspecie: especieInfo ? `${especieInfo.codigo || 'SC'} - ${especieInfo.nome}` : `Desconhecida (ID: ${item.especie_id})`,
                numero_romaneio: entradaInfo ? entradaInfo.id_externo || entradaInfo.numero_registro : "N/A",
                total_duplicados: itens.length, // Quantos itens têm a mesma árvore + seção
                grupo_duplicacao: chave // Para agrupar visualmente
              });
            });
          }
        });

        // Ordenar por número da árvore e seção
        data = arvoresDuplicadas.sort((a, b) => 
          (a.numero_arvore || 0) - (b.numero_arvore || 0) || 
          (a.seccao || '').localeCompare(b.seccao || '')
        );
      } else if (reportType === RELATORIO_TYPES.VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO) {
        const [todosItensEntradaDb, todasEntradasDb] = await Promise.all([
          EntradaItem.list().catch(e => { console.error("Erro ao listar EntradaItem em VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO:", e); throw e; }),
          Entrada.list().catch(e => { console.error("Erro ao listar Entrada em VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO:", e); throw e; })
        ]);

        let itensParaVerificacao = todosItensEntradaDb;
        
        // Se um filtro de espécie for aplicado, só serão mostradas inconsistências DENTRO
        // de árvores que possuem essa espécie.
        if (filters.especie_id !== ALL_SPECIES_VALUE) {
          const numerosArvoresComEspecieFiltrada = new Set();
          todosItensEntradaDb.forEach(item => {
            if (item.especie_id === filters.especie_id) {
              numerosArvoresComEspecieFiltrada.add(item.numero_arvore);
            }
          });
          itensParaVerificacao = itensParaVerificacao.filter(item => 
            numerosArvoresComEspecieFiltrada.has(item.numero_arvore)
          );
        }
         
        // Aplicar filtro de número de árvore específico
        if (filters.numero_arvore_filtro) {
          itensParaVerificacao = itensParaVerificacao.filter(item => 
            String(item.numero_arvore) === String(filters.numero_arvore_filtro)
          );
        } 
        // Aplicar filtro de intervalo de número de árvore se o específico não estiver preenchido
        else if (filters.intervalo_inicio_inconsistencia_filtro || filters.intervalo_fim_inconsistencia_filtro) {
          const inicio = parseInt(filters.intervalo_inicio_inconsistencia_filtro, 10);
          const fim = parseInt(filters.intervalo_fim_inconsistencia_filtro, 10);

          if (isNaN(inicio) || isNaN(fim) || inicio <= 0 || fim <= 0 || inicio > fim) {
             setPageError("Intervalo de Número de Árvore inválido. Verifique os números de início e fim. Ambos devem ser números inteiros maiores que zero, e o número inicial não pode ser maior que o final.");
             itensParaVerificacao = []; // Limpa os itens para não mostrar dados incorretos
          } else {
            itensParaVerificacao = itensParaVerificacao.filter(item => {
              const numArvore = parseInt(item.numero_arvore, 10);
              return numArvore >= inicio && numArvore <= fim;
            });
          }
        }

        // Agrupar itens por numero_arvore
        const gruposPorNumeroArvore = {};
        itensParaVerificacao.forEach(item => {
          if (!gruposPorNumeroArvore[item.numero_arvore]) {
            gruposPorNumeroArvore[item.numero_arvore] = [];
          }
          gruposPorNumeroArvore[item.numero_arvore].push(item);
        });

        const arvoresComInconsistencia = [];
        Object.values(gruposPorNumeroArvore).forEach(itensDaMesmaArvore => {
          if (itensDaMesmaArvore.length <= 1) return; // Precisa de pelo menos 2 seções para ter inconsistência

          const especiesIdsDaArvore = new Set(itensDaMesmaArvore.map(item => item.especie_id));
          
          if (especiesIdsDaArvore.size > 1) { // Se há mais de um especie_id diferente para o mesmo numero_arvore
            itensDaMesmaArvore.forEach((item, index) => {
              const especieInfo = todasEspeciesLocal.find(e => e.id === item.especie_id);
              const entradaInfo = todasEntradasDb.find(ent => ent.id === item.entrada_id);
              
              arvoresComInconsistencia.push({
                ...item,
                id: `${item.id}_inc_${index}`, // ID único para renderização
                item_id_original: item.id, // Manter ID original para edição
                nomeEspecie: especieInfo ? `${especieInfo.codigo || 'SC'} - ${especieInfo.nome}` : `Desconhecida (ID: ${item.especie_id})`,
                numero_romaneio: entradaInfo ? entradaInfo.id_externo || entradaInfo.numero_registro : "N/A",
                grupo_inconsistencia: item.numero_arvore // Para agrupar visualmente
              });
            });
          }
        });

        data = arvoresComInconsistencia.sort((a, b) => 
          (a.numero_arvore || 0) - (b.numero_arvore || 0) || 
          (a.seccao || '').localeCompare(b.seccao || '')
        );
      } else if (reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA) {
        const [todosItensEntradaDb, todasEntradasDb] = await Promise.all([
          EntradaItem.list().catch(e => { console.error("Erro ao listar EntradaItem:", e); throw e; }),
          Entrada.list().catch(e => { console.error("Erro ao listar Entrada:", e); throw e; })
        ]);

        let itensParaVerificacao = todosItensEntradaDb;

        // Aplicar filtro de espécie se selecionado
        if (filters.especie_id !== ALL_SPECIES_VALUE) {
          itensParaVerificacao = itensParaVerificacao.filter(item => item.especie_id === filters.especie_id);
        }
        // Aplicar filtro de número de árvore específico
        if (filters.numero_arvore_filtro) {
          itensParaVerificacao = itensParaVerificacao.filter(item => 
            String(item.numero_arvore) === String(filters.numero_arvore_filtro)
          );
        } 
        // Aplicar filtro de intervalo de número de árvore (usando os mesmos filtros de intervalo da inconsistência)
        else if (filters.intervalo_inicio_inconsistencia_filtro || filters.intervalo_fim_inconsistencia_filtro) {
          const inicio = parseInt(filters.intervalo_inicio_inconsistencia_filtro, 10);
          const fim = parseInt(filters.intervalo_fim_inconsistencia_filtro, 10);

          if (!isNaN(inicio) && !isNaN(fim) && inicio > 0 && fim > 0 && inicio <= fim) {
            itensParaVerificacao = itensParaVerificacao.filter(item => {
              const numArvore = parseInt(item.numero_arvore, 10);
              return numArvore >= inicio && numArvore <= fim;
            });
          } else if ((filters.intervalo_inicio_inconsistencia_filtro && (isNaN(inicio) || inicio <=0)) || (filters.intervalo_fim_inconsistencia_filtro && (isNaN(fim) || fim <=0)) || (!isNaN(inicio) && !isNaN(fim) && inicio > fim) ){
             setPageError("Intervalo de Número de Árvore inválido. Verifique os números de início e fim. Ambos devem ser números inteiros maiores que zero, e o número inicial não pode ser maior que o final.");
             itensParaVerificacao = [];
          }
        }

        // Agrupar itens por numero_arvore
        const gruposPorNumeroArvore = {};
        itensParaVerificacao.forEach(item => {
          if (!gruposPorNumeroArvore[item.numero_arvore]) {
            gruposPorNumeroArvore[item.numero_arvore] = [];
          }
          gruposPorNumeroArvore[item.numero_arvore].push(item);
        });

        const arvoresComSecaoUnica = [];
        Object.values(gruposPorNumeroArvore).forEach(itensDaMesmaArvore => {
          // Contar seções distintas (case-insensitive para 'a' e 'A' serem a mesma seção)
          const secoesDaArvore = new Set(itensDaMesmaArvore.map(item => item.seccao?.toUpperCase()));
          
          if (secoesDaArvore.size === 1) { // Se há apenas uma seção para este numero_arvore
            itensDaMesmaArvore.forEach((item, index) => { // Adiciona todos os itens (pode haver duplicidade de seção A, por exemplo)
              const especieInfo = todasEspeciesLocal.find(e => e.id === item.especie_id);
              const entradaInfo = todasEntradasDb.find(ent => ent.id === item.entrada_id);
              
              arvoresComSecaoUnica.push({
                ...item,
                id: `${item.id}_secunica_${index}`, // ID único para renderização
                item_id_original: item.id,
                nomeEspecie: especieInfo ? `${especieInfo.codigo || 'SC'} - ${especieInfo.nome}` : `Desconhecida (ID: ${item.especie_id})`,
                numero_romaneio: entradaInfo ? entradaInfo.id_externo || entradaInfo.numero_registro : "N/A",
                grupo_secao_unica: item.numero_arvore 
              });
            });
          }
        });

        data = arvoresComSecaoUnica.sort((a, b) => 
          (a.numero_arvore || 0) - (b.numero_arvore || 0) || 
          (a.seccao || '').localeCompare(b.seccao || '')
        );
      }
      
      setReportData(data);
      console.log("[RelatoriosPage] Relatório gerado:", data);

    } catch (error) {
      console.error("[RelatoriosPage] Erro ao gerar relatório:", error);
      let errorMsg = `Erro ao gerar relatório: ${error.message || "Erro desconhecido"}.`;
      if (error.message && error.message.toLowerCase().includes("network error")) {
          errorMsg = "Erro de rede ao buscar dados para o relatório. Verifique sua conexão e tente novamente.";
      } else if (error.response && error.response.status === 429) {
          errorMsg = "Muitas solicitações ao servidor ao gerar o relatório. Tente novamente em alguns minutos.";
      }
      setPageError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditInlineChange = (field, value) => {
    let processedValue = value;
    if (["diametro1", "diametro2", "diametro3", "comprimento1", "comprimento2"].includes(field)) {
      processedValue = String(value).replace(',', '.'); // Permitir vírgula para decimais e converter para ponto
    } else if (field === "seccao") {
      processedValue = String(value).toUpperCase().slice(0,1);
    } else if (field === "numero_arvore") {
      processedValue = String(value); // Manter como string para input
    }

    setEditingItemData(prev => {
        const updated = { ...prev, [field]: processedValue };
        
        // Recalcular volumes se campos relevantes mudarem
        if (["diametro1", "diametro2", "comprimento1", "diametro3", "comprimento2"].includes(field)) {
            const d1 = parseFloat(updated.diametro1);
            const d2 = parseFloat(updated.diametro2);
            const c1 = parseFloat(updated.comprimento1);
            const d3 = parseFloat(updated.diametro3); // Pode ser null/undefined
            const c2 = parseFloat(updated.comprimento2); // Pode ser null/undefined

            // Volume Florestal: usa D1, D2 e C1
            let volFlor = 0;
            if (!isNaN(d1) && !isNaN(d2) && !isNaN(c1) && d1 > 0 && d2 > 0 && c1 > 0) {
                volFlor = calcularVolume(d1, d2, c1);
            }
            updated.volume_florestal = volFlor;

            // Volume Comercial: usa diâmetro efetivo e comprimento efetivo
            let volCom = 0;
            let diametro_efetivo = null;
            let comprimento_efetivo = null;

            // Determinar diâmetro efetivo (D3 tem prioridade, senão D2)
            if (!isNaN(d3) && d3 > 0) {
              diametro_efetivo = d3;
            } else if (!isNaN(d2) && d2 > 0) {
              diametro_efetivo = d2;
            }

            // Determinar comprimento efetivo (C2 tem prioridade, senão C1)
            if (c2 !== null && !isNaN(c2) && c2 > 0) {
              comprimento_efetivo = c2;
            } else if (!isNaN(c1) && c1 > 0) {
              comprimento_efetivo = c1;
            }
            
            if (diametro_efetivo !== null && comprimento_efetivo !== null) {
              volCom = calcularVolume(diametro_efetivo, diametro_efetivo, comprimento_efetivo);
            }
            updated.volume_comercial = volCom;
        }
        return updated;
    });
  };

  const startEditInline = async (item) => {
    setFeedback(null);
    setEditLoading(true);
    setPageError(null); // Limpar erros da página
    try {
      const saidasDoItem = await SaidaItem.filter({ entrada_item_id: item.id }).catch(e => {
        console.error("Erro ao filtrar SaidaItem em startEditInline:", e); throw e;
      });
      if (saidasDoItem.length > 0) {
        setFeedback({ type: "error", message: `Item Árvore ${item.numero_arvore} / Seç. ${item.seccao} (Rom. ${item.numero_romaneio}) não pode ser editado pois já possui ${saidasDoItem.length} saída(s).` });
        setEditingItemId(null);
        setEditingItemData(null);
        return;
      }
      setEditingItemId(item.id);
      // Certificar que todos os campos numéricos são strings para os inputs, e volumes são números
      setEditingItemData({
        ...item,
        numero_arvore: String(item.numero_arvore || ""),
        diametro1: String(item.diametro1 || ""),
        diametro2: String(item.diametro2 || ""),
        comprimento1: String(item.comprimento1 || ""),
        diametro3: String(item.diametro3 || ""),
        comprimento2: String(item.comprimento2 || ""),
        volume_florestal: parseFloat(item.volume_florestal || 0),
        volume_comercial: parseFloat(item.volume_comercial || 0),
      });
      clearSelections(); // Limpar seleções ao iniciar edição
    } catch (err) {
      console.error("Erro ao verificar saídas do item para edição:", err);
      let errorMsg = "Erro ao verificar status do item. Tente novamente.";
      if (err.message && err.message.toLowerCase().includes("network error")) {
          errorMsg = "Erro de rede ao verificar status do item. Verifique sua conexão e tente novamente.";
      } else if (err.response && err.response.status === 429) {
        errorMsg = "Muitas solicitações ao verificar status do item. Tente novamente em alguns minutos.";
      } else if (err.response && err.response.data && err.response.data.message) {
        errorMsg = err.response.data.message;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setFeedback({ type: "error", message: errorMsg });
      setPageError(errorMsg); // Também mostrar no erro da página para erros de rede
    } finally {
      setEditLoading(false);
    }
  };

  const cancelEditInline = () => {
    setEditingItemId(null);
    setEditingItemData(null);
    setFeedback(null);
  };

  const saveEditInline = async () => {
    if (!editingItemData) return;
    setEditLoading(true);
    setFeedback(null);
    setPageError(null);

    try {
      // Destructurar e remover campos que não devem ser enviados para o update da API
      const { id, nomeEspecie, entrada_id, created_by, created_date, updated_date, numero_romaneio, total_duplicados, grupo_duplicacao, item_id_original, grupo_inconsistencia, grupo_secao_unica, ...dataToUpdate } = editingItemData;
      
      // Validação básica
      if (!dataToUpdate.numero_arvore || String(dataToUpdate.numero_arvore).trim() === '' ||
          !dataToUpdate.seccao || String(dataToUpdate.seccao).trim() === '' ||
          !dataToUpdate.especie_id || 
          !dataToUpdate.diametro1 || String(dataToUpdate.diametro1).trim() === '' ||
          !dataToUpdate.diametro2 || String(dataToUpdate.diametro2).trim() === '' ||
          !dataToUpdate.comprimento1 || String(dataToUpdate.comprimento1).trim() === '') {
        setFeedback({ type: "error", message: "Campos obrigatórios (Nº Árvore, Seção, Espécie, D1, D2, C1) devem ser preenchidos." });
        setEditLoading(false);
        return;
      }

      // Converter para números antes de salvar e recalcular volumes finais
      const payload = {
        ...dataToUpdate,
        numero_arvore: parseInt(dataToUpdate.numero_arvore),
        diametro1: parseFloat(dataToUpdate.diametro1),
        diametro2: parseFloat(dataToUpdate.diametro2), // Corrigido: dataToToUpdate -> dataToUpdate
        comprimento1: parseFloat(dataToUpdate.comprimento1),
        // diametro3 e comprimento2 podem ser nulos/vazios
        diametro3: dataToUpdate.diametro3 ? parseFloat(dataToUpdate.diametro3) : null,
        comprimento2: dataToUpdate.comprimento2 ? parseFloat(dataToUpdate.comprimento2) : null,
        // Volumes já devem estar corretos em editingItemData devido ao handleEditInlineChange,
        // que agora usa calcularVolume com 4 casas.
        volume_florestal: parseFloat(editingItemData.volume_florestal || 0), // Será número com até 4 casas
        volume_comercial: parseFloat(editingItemData.volume_comercial || 0), // Será número com até 4 casas
        is_dormente: !!dataToUpdate.is_dormente, // Garantir booleano
      };
      
      // Remover campos nulos de diametro3 e comprimento2 se não foram preenchidos, para evitar enviar 'null' se a API não espera ou for indesejável
      if (payload.diametro3 === null || isNaN(payload.diametro3)) delete payload.diametro3;
      if (payload.comprimento2 === null || isNaN(payload.comprimento2)) delete payload.comprimento2;


      await EntradaItem.update(editingItemId, payload);

      // Atualizar reportData localmente
      setReportData(prevData => 
        prevData.map(item => 
          item.item_id_original === editingItemId || item.id === editingItemId
            ? { 
                ...item, 
                ...payload, 
                nomeEspecie: especies.find(e => e.id === payload.especie_id)?.nome || item.nomeEspecie,
                // Garantir que os campos numéricos voltem para string para exibir corretamente se iniciar edição novamente
                numero_arvore: String(payload.numero_arvore),
                diametro1: String(payload.diametro1),
                diametro2: String(payload.diametro2),
                comprimento1: String(payload.comprimento1),
                diametro3: payload.diametro3 !== null && !isNaN(payload.diametro3) ? String(payload.diametro3) : "",
                comprimento2: payload.comprimento2 !== null && !isNaN(payload.comprimento2) ? String(payload.comprimento2) : "",
                // Volumes para exibição, já são números com até 4 casas. formatarNumero cuidará da exibição.
                volume_florestal: payload.volume_florestal,
                volume_comercial: payload.volume_comercial,
              } 
            : item
        )
      );
      
      setFeedback({ type: "success", message: "Item atualizado com sucesso!" });
      setEditingItemId(null);
      setEditingItemData(null);

    } catch (error) {
      console.error("Erro ao atualizar item:", error);
      let errorMsg = "Erro ao atualizar item.";
      if (error.message && error.message.toLowerCase().includes("network error")) {
        errorMsg = "Erro de rede ao atualizar item. Verifique sua conexão e tente novamente.";
      } else if (error.response && error.response.status === 429) {
        errorMsg = "Muitas solicitações ao servidor ao salvar. Tente novamente em alguns minutos.";
      } else if (error.response && error.response.data && error.response.data.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setFeedback({ type: "error", message: errorMsg });
      setPageError(errorMsg);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteClick = async (item) => {
    setFeedback(null);
    setPageError(null);
    const itemId = item.item_id_original || item.id; // Usar ID original se for de relatório de duplicadas ou inconsistências
    setDeleteActionLoadingItemId(itemId);

    try {
      // Primeiro, verificar se o item ainda existe
      try {
        await EntradaItem.get(itemId).catch(e => {
          console.error("Erro ao buscar EntradaItem em handleDeleteClick:", e); throw e;
        });
      } catch (getError) {
        if (getError.message && getError.message.toLowerCase().includes("network error")){
           setFeedback({ type: "error", message: `Erro de rede ao verificar item. Verifique sua conexão.` });
           setDeleteActionLoadingItemId(null);
           return;
        } else if (getError.response && getError.response.status === 404) {
          setFeedback({ 
            type: "error", 
            message: `Item Árvore ${item.numero_arvore} / Seç. ${item.seccao} (Rom. ${item.numero_romaneio}) não existe mais no sistema. Atualize o relatório.` 
          });
          // Remover o item da lista local também
          setReportData(prevData => 
            prevData.filter(i => (i.item_id_original || i.id) !== itemId)
          );
          setDeleteActionLoadingItemId(null); // Ensure loading state is reset on early exit
          return;
        }
        throw getError; // Re-throw se for outro tipo de erro
      }

      // Se o item existe, verificar se tem saídas
      const saidasDoItem = await SaidaItem.filter({ entrada_item_id: itemId }).catch(e => {
        console.error("Erro ao filtrar SaidaItem em handleDeleteClick:", e); throw e;
      });
      if (saidasDoItem.length > 0) {
        setFeedback({ 
          type: "error", 
          message: `Item Árvore ${item.numero_arvore} / Seç. ${item.seccao} (Rom. ${item.numero_romaneio}) não pode ser excluído pois já possui ${saidasDoItem.length} saída(s).` 
        });
        setDeleteActionLoadingItemId(null); // Ensure loading state is reset on early exit
        return;
      }
      
      // Se não tem saídas, prepara para confirmação
      setItemToDelete(item);
      setShowDeleteDialog(true);
      clearSelections(); // Limpar seleções ao iniciar exclusão de item único

    } catch (err) {
      console.error("Erro ao verificar item para exclusão:", err);
      let errorMsg = "Erro ao verificar status do item para exclusão.";
      
      if (err.message && err.message.toLowerCase().includes("network error")) {
        errorMsg = "Erro de rede ao verificar item. Verifique sua conexão.";
      } else if (err.response) {
        if (err.response.status === 404) {
          errorMsg = `Item não encontrado no sistema. Pode ter sido excluído por outro usuário.`;
          // Remover da lista local
          setReportData(prevData => 
            prevData.filter(i => (i.item_id_original || i.id) !== itemId)
          );
        } else if (err.response.status === 429) {
          errorMsg = "Muitas solicitações ao servidor. Aguarde alguns minutos e tente novamente.";
        } else {
          errorMsg = `Erro do servidor (${err.response.status}): ${err.response.data?.message || err.message}`;
        }
      } else {
        errorMsg = `Erro de conexão: ${err.message}`;
      }
      
      setFeedback({ type: "error", message: errorMsg });
      setPageError(errorMsg); // Também mostrar no erro da página
    } finally {
      setDeleteActionLoadingItemId(null);
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    setIsDeletingItem(true);
    setFeedback(null);
    setPageError(null);
    const itemIdToDelete = itemToDelete.item_id_original || itemToDelete.id;

    try {
      await EntradaItem.delete(itemIdToDelete);
      
      // Atualizar reportData localmente
      setReportData(prevData => 
        prevData.filter(i => (i.item_id_original || i.id) !== itemIdToDelete)
      );
      
      setFeedback({ 
        type: "success", 
        message: `Item Árvore ${itemToDelete.numero_arvore} / Seç. ${itemToDelete.seccao} excluído com sucesso!` 
      });
      
    } catch (error) {
      console.error("Erro ao excluir item:", error);
      let errorMsg = "Erro ao excluir item.";
      
      if (error.message && error.message.toLowerCase().includes("network error")) {
        errorMsg = "Erro de rede ao excluir item. Verifique sua conexão e tente novamente.";
      } else if (error.response) {
        if (error.response.status === 404) {
          errorMsg = `Item não encontrado. Pode ter sido excluído por outro usuário.`;
          // Remover da lista local mesmo assim
          setReportData(prevData => 
            prevData.filter(i => (i.item_id_original || i.id) !== itemIdToDelete)
          );
          setFeedback({ 
            type: "success", 
            message: `Item removido da lista (já havia sido excluído do sistema).` 
          });
        } else if (error.response.status === 429) {
          errorMsg = "Muitas solicitações ao servidor. Aguarde alguns minutos e tente novamente.";
        } else if (error.response.status === 400 && error.response.data && error.response.data.message) {
          errorMsg = error.response.data.message;
        } else {
          errorMsg = `Erro do servidor (${error.response.status}): ${error.response.data?.message || error.message}`;
        }
      } else {
        errorMsg = `Erro de conexão: ${error.message}`;
      }
      
      if (error.response?.status !== 404) { // Only set error feedback if it's not a 404 (which is handled as a success)
        setFeedback({ type: "error", message: errorMsg });
        setPageError(errorMsg); // Also set page error for actual errors
      }
      
    } finally {
      setIsDeletingItem(false);
      setShowDeleteDialog(false);
      setItemToDelete(null);
    }
  };
  
  // Funções para seleção em lote
  const handleSelectItem = (itemId, isSelected) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isSelected) => {
    setSelectAll(isSelected);
    if (isSelected && reportData) {
      // Selecionar todos os itens visíveis e filtráveis
      const allItemIds = reportData.map(item => item.item_id_original || item.id);
      setSelectedItems(new Set(allItemIds));
    } else {
      // Deselecionar todos
      setSelectedItems(new Set());
    }
  };

  const clearSelections = () => {
    setSelectedItems(new Set());
    setSelectAll(false);
  };

  // Função para excluir itens selecionados
  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) {
      setFeedback({ type: "error", message: "Nenhum item selecionado para exclusão." });
      return;
    }

    // Verificar se algum item selecionado tem saídas
    setFeedback(null);
    setPageError(null);
    setIsDeletingItem(true);

    try {
      const itemsToDelete = [];
      const itemsWithExits = [];
      const itemsNotFoundOrAlreadyDeleted = [];

      // Verificar cada item selecionado
      for (const itemId of selectedItems) {
        const item = reportData.find(i => (i.item_id_original || i.id) === itemId);
        if (!item) { // Item não encontrado na lista atual (pode ter sido filtrado ou já removido)
          itemsNotFoundOrAlreadyDeleted.push(`ID: ${itemId}`);
          continue;
        }

        try {
          // Verificar se o item ainda existe na base de dados
          await EntradaItem.get(itemId).catch(e => {console.error(`Erro ao buscar EntradaItem ${itemId} em handleDeleteSelected:`, e); throw e;});
          
          // Verificar se tem saídas
          const saidasDoItem = await SaidaItem.filter({ entrada_item_id: itemId }).catch(e => {console.error(`Erro ao filtrar SaidaItem para ${itemId} em handleDeleteSelected:`, e); throw e;});
          if (saidasDoItem.length > 0) {
            itemsWithExits.push(`Árvore ${item.numero_arvore} / Seç. ${item.seccao}`);
          } else {
            itemsToDelete.push(item);
          }
        } catch (getError) {
          if (getError.message && getError.message.toLowerCase().includes("network error")) {
            throw new Error(`Erro de rede ao processar item ${item?.numero_arvore || itemId}. Verifique sua conexão.`); // Re-throw para ser pego pelo catch externo
          } else if (getError.response && getError.response.status === 404) {
            itemsNotFoundOrAlreadyDeleted.push(`Árvore ${item.numero_arvore} / Seç. ${item.seccao}`);
          } else {
            throw getError;
          }
        }
      }

      // Mostrar avisos se necessário
      let warningMessage = "";
      if (itemsWithExits.length > 0) {
        warningMessage += `\n${itemsWithExits.length} item(s) não podem ser excluídos pois possuem saída(s): ${itemsWithExits.join(", ")}.`;
      }
      if (itemsNotFoundOrAlreadyDeleted.length > 0) {
        warningMessage += `\n${itemsNotFoundOrAlreadyDeleted.length} item(s) não encontrados no sistema ou já excluídos: ${itemsNotFoundOrAlreadyDeleted.join(", ")}.`;
      }

      if (itemsToDelete.length === 0) {
        setFeedback({ 
          type: "error", 
          message: "Nenhum item válido para exclusão foi selecionado." + warningMessage
        });
        // Atualizar lista local para remover os itens não encontrados/já excluídos
        setReportData(prevData => prevData.filter(i => {
          const itemId = i.item_id_original || i.id;
          return !selectedItems.has(itemId) || itemsNotFoundOrAlreadyDeleted.some(name => name.includes(itemId));
        }));
        clearSelections();
        setIsDeletingItem(false); // Reset loading state
        return;
      }

      // Preparar para confirmação
      const confirmMessage = `Deseja excluir ${itemsToDelete.length} item(s) selecionado(s)?` + warningMessage + "\n\nEsta ação não pode ser desfeita.";
      
      if (window.confirm(confirmMessage)) {
        // Excluir os itens
        const deletedIds = [];
        const failedDeletes = [];
        
        for (const item of itemsToDelete) {
          const itemId = item.item_id_original || item.id;
          try {
            await EntradaItem.delete(itemId).catch(e => {console.error(`Erro ao deletar EntradaItem ${itemId} em handleDeleteSelected:`, e); throw e;});
            deletedIds.push(itemId);
          } catch (error) {
            console.error(`Erro ao excluir item ${itemId}:`, error);
            if (error.message && error.message.toLowerCase().includes("network error")){
                 failedDeletes.push(`Erro de rede ao excluir Árvore ${item.numero_arvore} / Seç. ${item.seccao}. Verifique sua conexão.`);
            } else {
                 failedDeletes.push(`Árvore ${item.numero_arvore} / Seç. ${item.seccao}`);
            }
          }
        }

        // Atualizar a lista local
        setReportData(prevData => 
          prevData.filter(i => !deletedIds.includes(i.item_id_original || i.id))
        );

        // Limpar seleções
        clearSelections();

        // Mensagem de resultado
        let resultMessage = `${deletedIds.length} item(s) excluído(s) com sucesso!`;
        if (failedDeletes.length > 0) {
          resultMessage += ` Falha ao excluir: ${failedDeletes.join(", ")}.`;
        }
        if (warningMessage) {
          resultMessage += ` ${warningMessage.trim()}`;
        }

        setFeedback({ 
          type: deletedIds.length > 0 ? "success" : "error", 
          message: resultMessage 
        });
      } else {
        setFeedback({ type: "info", message: "Operação de exclusão em lote cancelada." });
      }

    } catch (error) {
      console.error("Erro na exclusão em lote:", error);
      let errorMsg = "Erro ao processar exclusão em lote. Tente novamente.";
      if (error.message && error.message.toLowerCase().includes("network error")) {
        errorMsg = error.message; // Usa a mensagem de erro de rede mais específica, se disponível
      } else if (error.response && error.response.status === 429) {
        errorMsg = "Muitas solicitações ao servidor. Aguarde alguns minutos e tente novamente.";
      } else if (error.response && error.response.data && error.response.data.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setFeedback({ 
        type: "error", 
        message: errorMsg 
      });
      setPageError(errorMsg); // Também mostrar no erro da página
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleGeneratePDFReport = async () => {
    if (!reportData || reportData.length === 0) {
      setFeedback({ type: 'error', message: 'Nenhum dado para gerar o PDF.' });
      return;
    }
    setGeneratingPDF(true);
    setFeedback(null);
    setPageError(null);

    try {
      let reportTitle = "Relatório";
      let reportFileNamePrefix = "Relatorio";
      let reportSubtitle = "Filtros Aplicados: ";
      const activeFilters = [];

      if (filters.especie_id !== ALL_SPECIES_VALUE && especies.find(e => e.id === filters.especie_id)) {
        activeFilters.push(`Espécie: ${especies.find(e => e.id === filters.especie_id).nome}`);
      }
      if (filters.numero_arvore_filtro) {
        activeFilters.push(`Nº Árvore: ${filters.numero_arvore_filtro}`);
      }
      
      let response;
      if (reportType === RELATORIO_TYPES.FILTRAR_ITENS_DE_ENTRADA) {
        reportTitle = "Relatório de Itens de Entrada Filtrados";
        reportFileNamePrefix = "Relatorio_Itens_Entrada_Filtrados";
        if (filters.seccao_filtro) activeFilters.push(`Seção: ${filters.seccao_filtro}`);
        if (filters.diametro1_filtro) activeFilters.push(`D1: ${filters.diametro1_filtro}`);
        if (filters.diametro2_filtro) activeFilters.push(`D2: ${filters.diametro2_filtro}`);
        if (filters.comprimento1_filtro) activeFilters.push(`C1: ${filters.comprimento1_filtro}`);
        if (filters.diametro3_filtro) activeFilters.push(`D3: ${filters.diametro3_filtro}`);
        if (filters.comprimento2_filtro) activeFilters.push(`C2: ${filters.comprimento2_filtro}`);

        reportSubtitle += activeFilters.length > 0 ? activeFilters.join(', ') : "Nenhum filtro específico.";

        response = await generateFilteredEntradaItensReportPDF({ 
          reportData, 
          filters, 
          reportTitle,
          reportSubtitle
        });
      } else if (reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA) {
        reportTitle = "Relatório de Árvores com Seção Única";
        reportFileNamePrefix = "Relatorio_Arvores_Secao_Unica";
        if (filters.intervalo_inicio_inconsistencia_filtro) activeFilters.push(`Nº Árvore Inicial: ${filters.intervalo_inicio_inconsistencia_filtro}`);
        if (filters.intervalo_fim_inconsistencia_filtro) activeFilters.push(`Nº Árvore Final: ${filters.intervalo_fim_inconsistencia_filtro}`);

        reportSubtitle += activeFilters.length > 0 ? activeFilters.join(', ') : "Nenhum filtro específico.";

        response = await generateSecaoUnicaReportPDF({
          reportData,
          filters, 
          reportTitle,
          reportSubtitle
        });
      } else {
        setFeedback({ type: 'info', message: 'Exportação PDF não disponível para este tipo de relatório.' });
        setGeneratingPDF(false);
        return;
      }
      

      if (response.status === 200 && response.data) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const contentDisposition = response.headers?.['content-disposition'];
        let fileName = `${reportFileNamePrefix}_${new Date().toISOString().split('T')[0]}.pdf`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (fileNameMatch && fileNameMatch.length === 2) {
                fileName = fileNameMatch[1];
            }
        }
        
        link.href = url;
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setFeedback({ type: 'success', message: 'Relatório PDF gerado com sucesso!' });
      } else {
        console.error("Erro ao gerar relatório PDF:", response.data?.error || "Resposta inválida do servidor");
        setFeedback({ type: 'error', message: `Erro ao gerar relatório PDF: ${response.data?.error || 'Tente novamente.'}` });
      }
    } catch (error) {
      console.error("Erro ao chamar a função de gerar relatório PDF:", error);
      let errorMsg = "Ocorreu um erro ao tentar gerar o relatório PDF. Verifique o console para mais detalhes.";
      if (error.message && error.message.toLowerCase().includes("network error")) {
        errorMsg = "Erro de rede ao gerar o PDF. Verifique sua conexão e tente novamente.";
      } else if (error.response && error.response.data && error.response.data.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setFeedback({ type: 'error', message: errorMsg });
      setPageError(errorMsg);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const renderReport = () => {
    if (loading) {
      return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" /><p className="mt-2">Gerando relatório...</p></div>;
    }
    if (!reportData) {
      return <div className="text-center p-8 text-gray-500">Selecione os filtros e clique em "Gerar Relatório".</div>;
    }
    // Ajuste para não mostrar "nenhum dado" se for lista de ausentes vazia, pois essa já tem sua própria mensagem de sucesso
    if (reportData.length === 0 && 
        reportType !== RELATORIO_TYPES.VERIFICAR_NUMEROS_AUSENTES && 
        reportType !== RELATORIO_TYPES.VERIFICAR_ARVORES_DUPLICADAS &&
        reportType !== RELATORIO_TYPES.VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO &&
        reportType !== RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA) { 
        return <div className="text-center p-8 text-gray-500">Nenhum dado encontrado para os filtros selecionados.</div>;
    }

    if (reportType === RELATORIO_TYPES.ESTOQUE_ATUAL_POR_ESPECIE) {
      const totalVolumeEstoque = reportData.reduce((sum, item) => sum + (item.volume || 0), 0);
      return (
        <Card>
          <CardHeader>
            <CardTitle>Estoque Atual por Espécie (Volume Comercial)</CardTitle>
            {filters.especie_id !== ALL_SPECIES_VALUE && especies.find(e => e.id === filters.especie_id) &&
              <CardDescription>Filtrado pela espécie: {especies.find(e => e.id === filters.especie_id).nome}</CardDescription>
            }
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Espécie</TableHead>
                  <TableHead className="text-right">Volume em Estoque (m³)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nomeEspecie}</TableCell>
                    <TableCell className="text-right font-mono">{formatarNumero(item.volume, 4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-gray-100 font-semibold">
                  <TableCell>TOTAL GERAL</TableCell>
                  <TableCell className="text-right font-mono">{formatarNumero(totalVolumeEstoque, 4)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      );
    } else if (reportType === RELATORIO_TYPES.FILTRAR_ITENS_DE_ENTRADA) {
      // Recalcular totais com base nos dados editados, se houver
      const totalVolFlorestal = reportData.reduce((sum, item) => {
        const currentVolume = editingItemId === item.id ? editingItemData?.volume_florestal : item.volume_florestal;
        return sum + (parseFloat(currentVolume) || 0);
      }, 0);

      const totalVolComercial = reportData.reduce((sum, item) => {
        const currentVolume = editingItemId === item.id ? editingItemData?.volume_comercial : item.volume_comercial;
        return sum + (parseFloat(currentVolume) || 0);
      }, 0);

      return (
        <Card>
          <CardHeader>
            <CardTitle>Itens de Entrada Filtrados</CardTitle>
            <CardDescription>
              Lista de itens de entrada conforme os filtros aplicados. 
              {selectedItems.size > 0 && (
                <span className="font-semibold text-blue-600 ml-2">
                  {selectedItems.size} item(s) selecionado(s)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feedback && (
                <Alert variant={feedback.type === 'success' ? 'default' : 'destructive'} className={`mb-4 ${feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}`}>
                    {feedback.type === 'error' && <AlertCircle className="h-4 w-4" />}
                    {feedback.type === 'success' && <CheckCircle className="h-4 w-4" />}
                    <AlertTitle>{feedback.type === 'success' ? 'Sucesso' : 'Erro'}</AlertTitle>
                    <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
            )}

            {/* Botões de ação em lote */}
            {reportData.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(!selectAll)}
                  disabled={editingItemId || isDeletingItem}
                >
                  {selectAll ? "Desmarcar Todos" : "Selecionar Todos"}
                </Button>
                
                {selectedItems.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelections}
                      disabled={editingItemId || isDeletingItem}
                    >
                      Limpar Seleção
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={editingItemId || isDeletingItem}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeletingItem ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Excluir Selecionados ({selectedItems.size})
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="overflow-x-auto max-h-[65vh]"> {/* Adicionado para rolagem vertical e horizontal */}
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10"> {/* Tornar cabeçalho fixo */}
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectAll && reportData.length > 0 && selectedItems.size === reportData.length} // Check all logic
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={editingItemId || isDeletingItem || reportData.length === 0}
                        className="rounded"
                      />
                    </TableHead>
                    
                    <TableHead className="w-24">Nº Roman.</TableHead>
                    <TableHead className="w-16">Nº Árv.</TableHead>
                    <TableHead className="w-32">Espécie</TableHead>
                    <TableHead className="w-12">Seç.</TableHead>
                    <TableHead className="text-right w-20">D1(cm)</TableHead>
                    <TableHead className="text-right w-20">D2(cm)</TableHead>
                    <TableHead className="text-right w-20">C1(m)</TableHead>
                    <TableHead className="text-right w-24">Vol.Flor.</TableHead>
                    <TableHead className="text-right w-20">D3(cm)</TableHead>
                    <TableHead className="text-right w-20">C2(m)</TableHead>
                    <TableHead className="text-right w-24">Vol.Com.</TableHead>
                    <TableHead className="text-center w-16">Dorm?</TableHead>
                    <TableHead className="text-center w-36">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((item) => {
                    const isEditingThisItem = editingItemId === item.id;
                    const currentData = isEditingThisItem ? editingItemData : item;
                    const itemIdForActions = item.item_id_original || item.id;
                    const isItemDeleteLoading = deleteActionLoadingItemId === itemIdForActions;
                    const isSelected = selectedItems.has(itemIdForActions);

                    return (
                    <TableRow key={item.id} className={`${isEditingThisItem ? "bg-amber-50" : ""} ${isSelected ? "bg-blue-50" : ""}`}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectItem(itemIdForActions, e.target.checked)}
                          disabled={isEditingThisItem || isDeletingItem} // Disable individual checkbox if item is being edited or global deleting
                          className="rounded"
                        />
                      </TableCell>
                      
                      <TableCell className="font-medium">{currentData.numero_romaneio}</TableCell>
                      <TableCell>
                        {isEditingThisItem ? (
                          <Input type="number" value={currentData.numero_arvore} onChange={(e) => handleEditInlineChange('numero_arvore', e.target.value)} className="h-8 text-xs w-16" min="1"/>
                        ) : currentData.numero_arvore}
                      </TableCell>
                      <TableCell>
                        {isEditingThisItem ? (
                          <Select value={currentData.especie_id} onValueChange={(val) => handleEditInlineChange('especie_id', val)}>
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Espécie" />
                            </SelectTrigger>
                            <SelectContent>
                              {especies.map(esp => <SelectItem key={esp.id} value={esp.id} className="text-xs">{esp.codigo} - {esp.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : currentData.nomeEspecie}
                      </TableCell>
                      <TableCell>
                        {isEditingThisItem ? (
                          <Input value={currentData.seccao} onChange={(e) => handleEditInlineChange('seccao', e.target.value)} className="h-8 text-xs w-10 uppercase" maxLength={1}/>
                        ) : currentData.seccao}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditingThisItem ? (
                          <Input type="number" step="0.1" value={currentData.diametro1} onChange={(e) => handleEditInlineChange('diametro1', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.0"/>
                        ) : formatarNumero(currentData.diametro1, 1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditingThisItem ? (
                          <Input type="number" step="0.1" value={currentData.diametro2} onChange={(e) => handleEditInlineChange('diametro2', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.0"/>
                        ) : formatarNumero(currentData.diametro2, 1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditingThisItem ? (
                          <Input type="number" step="0.01" value={currentData.comprimento1} onChange={(e) => handleEditInlineChange('comprimento1', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.00"/>
                        ) : formatarNumero(currentData.comprimento1, 2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatarNumero(currentData.volume_florestal, 4)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditingThisItem ? (
                          <Input type="number" step="0.1" value={currentData.diametro3} onChange={(e) => handleEditInlineChange('diametro3', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="-"/>
                        ) : (currentData.diametro3 ? formatarNumero(currentData.diametro3, 1) : '-')}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditingThisItem ? (
                          <Input type="number" step="0.01" value={currentData.comprimento2} onChange={(e) => handleEditInlineChange('comprimento2', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="-"/>
                        ) : (currentData.comprimento2 ? formatarNumero(currentData.comprimento2, 2) : '-')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatarNumero(currentData.volume_comercial, 4)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditingThisItem ? (
                          <button type="button" onClick={() => handleEditInlineChange('is_dormente', !currentData.is_dormente)} className="p-1" title="Marcar/Desmarcar Dormente">
                            {currentData.is_dormente ? <CheckSquare className="h-5 w-5 text-emerald-600" /> : <Square className="h-5 w-5 text-gray-400" />}
                          </button>
                        ) : (currentData.is_dormente ? "Sim" : "Não")}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditingThisItem ? (
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" onClick={saveEditInline} disabled={editLoading} className="h-8 w-8 hover:bg-green-100" title="Salvar">
                              {editLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={cancelEditInline} disabled={editLoading} className="h-8 w-8 hover:bg-red-100" title="Cancelar">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEditInline(item)} 
                              disabled={editLoading || editingItemId || deleteActionLoadingItemId || isDeletingItem} 
                              className="h-8 w-8 hover:bg-amber-100" 
                              title="Editar item"
                            >
                              <Pencil className="h-4 w-4 text-amber-600" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteClick(item)}
                              disabled={editLoading || editingItemId || deleteActionLoadingItemId || isDeletingItem}
                              className="h-8 w-8 hover:bg-red-100" 
                              title="Excluir item"
                            >
                              {isItemDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin text-red-600"/> : <Trash2 className="h-4 w-4 text-red-600" />}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-gray-100 font-semibold">
                    <TableCell></TableCell> {/* Coluna do checkbox */}
                    <TableCell colSpan={7}>TOTAIS:</TableCell>
                    <TableCell className="text-right font-mono">{formatarNumero(totalVolFlorestal, 4)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-mono">{formatarNumero(totalVolComercial, 4)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      );
    } else if (reportType === RELATORIO_TYPES.VERIFICAR_NUMEROS_AUSENTES) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SearchX className="h-5 w-5 mr-2 text-orange-600"/> 
              Números de Árvore Não Cadastrados
            </CardTitle>
            <CardDescription>
              Intervalo verificado: {filters.intervalo_inicio_filtro} a {filters.intervalo_fim_filtro}.
              {filters.especie_id !== ALL_SPECIES_VALUE && especies.find(e => e.id === filters.especie_id) && 
                ` Para a espécie: ${especies.find(e => e.id === filters.especie_id).nome}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportData.length === 0 ? (
              <p className="text-center text-green-600 py-4">Nenhum número ausente encontrado no intervalo para os filtros selecionados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">Número Ausente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.numero}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      );
    } else if (reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_DUPLICADAS) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-600"/> 
              Árvores Duplicadas (Mesmo Número + Seção)
            </CardTitle>
            <CardDescription>
              Lista de árvores com mesmo número e seção cadastradas em romaneios.
              {filters.especie_id !== ALL_SPECIES_VALUE && especies.find(e => e.id === filters.especie_id) && 
                ` Filtrado pela espécie: ${especies.find(e => e.id === filters.especie_id).nome}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportData.length === 0 ? (
              <p className="text-center text-green-600 py-4">Nenhuma árvore duplicada encontrada para os filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto max-h-[65vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-24">Nº Roman.</TableHead>
                      <TableHead className="w-16">Nº Árv.</TableHead>
                      <TableHead className="w-12">Seç.</TableHead>
                      <TableHead className="w-32">Espécie</TableHead>
                      <TableHead className="text-right w-20">D1(cm)</TableHead>
                      <TableHead className="text-right w-20">D2(cm)</TableHead>
                      <TableHead className="text-right w-20">C1(m)</TableHead>
                      <TableHead className="text-right w-24">Vol.Flor.</TableHead>
                      <TableHead className="text-right w-20">D3(cm)</TableHead>
                      <TableHead className="text-right w-20">C2(m)</TableHead>
                      <TableHead className="text-right w-24">Vol.Com.</TableHead>
                      <TableHead className="text-center w-16">Dorm?</TableHead>
                      <TableHead className="text-center w-20">Qtd Dup.</TableHead>
                      <TableHead className="text-center w-28">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => {
                      const isEditingThisItem = editingItemId === item.item_id_original;
                      const currentData = isEditingThisItem ? editingItemData : item;
                      
                      // Determinar a cor de fundo baseada no grupo de duplicação
                      const nextItem = reportData[index + 1];
                      const prevItem = reportData[index - 1];
                      const isFirstInGroup = !prevItem || prevItem.grupo_duplicacao !== item.grupo_duplicacao;
                      const isLastInGroup = !nextItem || nextItem.grupo_duplicacao !== item.grupo_duplicacao;
                      
                      let rowClass = "";
                      if (item.total_duplicados > 1) {
                        if (index % 2 === 0) { // Simple alternating color based on index for visual grouping
                          rowClass = "bg-red-50 border-l-4 border-red-300";
                        } else {
                          rowClass = "bg-red-100 border-l-4 border-red-400";
                        }
                      }
                      
                      if (isEditingThisItem) {
                        rowClass += " bg-amber-50";
                      }
                      
                      return (
                        <TableRow key={item.id} className={rowClass}>
                          <TableCell className="font-medium">{currentData.numero_romaneio}</TableCell>
                          <TableCell className="font-bold text-red-700">{currentData.numero_arvore}</TableCell>
                          <TableCell className="font-bold text-red-700 uppercase">{currentData.seccao}</TableCell>
                          <TableCell>{currentData.nomeEspecie}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarNumero(currentData.diametro1, 1)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarNumero(currentData.diametro2, 1)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarNumero(currentData.comprimento1, 2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarNumero(currentData.volume_florestal, 4)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {currentData.diametro3 ? formatarNumero(currentData.diametro3, 1) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {currentData.comprimento2 ? formatarNumero(currentData.comprimento2, 2) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarNumero(currentData.volume_comercial, 4)}
                          </TableCell>
                          <TableCell className="text-center">
                            {currentData.is_dormente ? "Sim" : "Não"}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                              {item.total_duplicados}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEditInline({
                                ...item,
                                id: item.item_id_original // Usar o ID original do EntradaItem
                              })} 
                              disabled={editLoading || editingItemId} 
                              className="h-8 w-8 hover:bg-amber-100" 
                              title="Editar item"
                            >
                              <Pencil className="h-4 w-4 text-amber-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      );
    } else if (reportType === RELATORIO_TYPES.VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600"/> 
              Inconsistência de Espécie por Seção
            </CardTitle>
            <CardDescription>
              Lista de árvores onde diferentes seções (mesmo número de árvore) possuem espécies diferentes cadastradas.
              {filters.especie_id !== ALL_SPECIES_VALUE && especies.find(e => e.id === filters.especie_id) && 
                ` Verificando inconsistências em árvores que possuem a espécie: ${especies.find(e => e.id === filters.especie_id).nome}.`
              }
              {filters.numero_arvore_filtro && ` Filtrado pelo Nº Árvore: ${filters.numero_arvore_filtro}.`}
              {(filters.intervalo_inicio_inconsistencia_filtro && filters.intervalo_fim_inconsistencia_filtro) && 
                ` Filtrado pelo intervalo de Nº Árvore: ${filters.intervalo_inicio_inconsistencia_filtro} a ${filters.intervalo_fim_inconsistencia_filtro}.`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feedback && (
              <Alert variant={feedback.type === 'success' ? 'default' : 'destructive'} className={`mb-4 ${feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}`}>
                  {feedback.type === 'error' && <AlertCircle className="h-4 w-4" />}
                  {feedback.type === 'success' && <CheckCircle className="h-4 w-4" />}
                  <AlertTitle>{feedback.type === 'success' ? 'Sucesso' : 'Erro'}</AlertTitle>
                  <AlertDescription>{feedback.message}</AlertDescription>
              </Alert>
            )}
            {reportData.length === 0 ? (
              <p className="text-center text-green-600 py-4">Nenhuma inconsistência de espécie por seção encontrada para os filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto max-h-[65vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-24">Nº Roman.</TableHead>
                      <TableHead className="w-16 font-bold text-orange-700">Nº Árv.</TableHead>
                      <TableHead className="w-12">Seç.</TableHead>
                      <TableHead className="w-40 font-bold text-orange-700">Espécie</TableHead>
                      <TableHead className="text-right w-20">D1(cm)</TableHead>
                      <TableHead className="text-right w-20">D2(cm)</TableHead>
                      <TableHead className="text-right w-20">C1(m)</TableHead>
                      <TableHead className="text-right w-24">Vol.Com.</TableHead>
                      <TableHead className="text-center w-28">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => {
                      const isEditingThisItem = editingItemId === item.item_id_original; // Edição baseada no ID original
                      const currentData = isEditingThisItem ? editingItemData : item;
                      const itemIdForActions = item.item_id_original || item.id;
                      const isItemDeleteLoading = deleteActionLoadingItemId === itemIdForActions;
                      
                      // Determinar a cor de fundo baseada no grupo de inconsistência
                      let rowClass = "";
                      // We can use the numero_arvore as an integer for simple alternation.
                      if (parseInt(item.numero_arvore) % 2 === 0) {
                         rowClass = "bg-orange-50 border-l-4 border-orange-300";
                      } else {
                         rowClass = "bg-orange-100 border-l-4 border-orange-400";
                      }
                      
                      if (isEditingThisItem) {
                        rowClass += " bg-amber-50"; // Overwrites or adds to editing highlight
                      }
                      
                      return (
                        <TableRow key={item.id} className={rowClass}>
                          <TableCell className="font-medium">{currentData.numero_romaneio}</TableCell>
                          <TableCell className="font-bold text-orange-700">{currentData.numero_arvore}</TableCell>
                          <TableCell className="uppercase">{currentData.seccao}</TableCell>
                          <TableCell className="font-semibold text-orange-800">{currentData.nomeEspecie}</TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? (
                              <Input type="number" step="0.1" value={currentData.diametro1} onChange={(e) => handleEditInlineChange('diametro1', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.0"/>
                            ) : formatarNumero(currentData.diametro1, 1)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? (
                              <Input type="number" step="0.1" value={currentData.diametro2} onChange={(e) => handleEditInlineChange('diametro2', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.0"/>
                            ) : formatarNumero(currentData.diametro2, 1)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? (
                              <Input type="number" step="0.01" value={currentData.comprimento1} onChange={(e) => handleEditInlineChange('comprimento1', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.00"/>
                            ) : formatarNumero(currentData.comprimento1, 2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? formatarNumero(editingItemData.volume_comercial, 4) : formatarNumero(currentData.volume_comercial, 4)}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditingThisItem ? (
                              <div className="flex gap-1 justify-center">
                                <Button variant="ghost" size="icon" onClick={saveEditInline} disabled={editLoading} className="h-8 w-8 hover:bg-green-100" title="Salvar">
                                  {editLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 text-green-600" />}
                                                </Button>
                                <Button variant="ghost" size="icon" onClick={cancelEditInline} disabled={editLoading} className="h-8 w-8 hover:bg-red-100" title="Cancelar">
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1 justify-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => startEditInline({
                                      ...item, // Passa o item completo
                                      id: item.item_id_original // But uses the original EntradaItem ID for the editing logic
                                  })} 
                                  disabled={editLoading || editingItemId || deleteActionLoadingItemId || isDeletingItem} 
                                  className="h-8 w-8 hover:bg-amber-100" 
                                  title="Editar item"
                                >
                                  <Pencil className="h-4 w-4 text-amber-600" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteClick({
                                      ...item,
                                      id: item.item_id_original
                                  })}
                                  disabled={editLoading || editingItemId || deleteActionLoadingItemId || isDeletingItem}
                                  className="h-8 w-8 hover:bg-red-100" 
                                  title="Excluir item"
                                >
                                  {isItemDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin text-red-600"/> : <Trash2 className="h-4 w-4 text-red-600" />}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      );
    } else if (reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SearchX className="h-5 w-5 mr-2 text-blue-600"/> 
              Árvores com Seção Única Cadastrada
            </CardTitle>
            <CardDescription>
              Lista de árvores que possuem apenas uma seção registrada. 
              Isso pode indicar um cadastro incompleto.
              {filters.especie_id !== ALL_SPECIES_VALUE && especies.find(e => e.id === filters.especie_id) && 
                ` Filtrado pela espécie: ${especies.find(e => e.id === filters.especie_id).nome}.`
              }
              {filters.numero_arvore_filtro && ` Filtrado pelo Nº Árvore: ${filters.numero_arvore_filtro}.`}
              {(filters.intervalo_inicio_inconsistencia_filtro && filters.intervalo_fim_inconsistencia_filtro) && 
                ` Filtrado pelo intervalo de Nº Árvore: ${filters.intervalo_inicio_inconsistencia_filtro} a ${filters.intervalo_fim_inconsistencia_filtro}.`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feedback && (
              <Alert variant={feedback.type === 'success' ? 'default' : 'destructive'} className={`mb-4 ${feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}`}>
                  {feedback.type === 'error' && <AlertCircle className="h-4 w-4" />}
                  {feedback.type === 'success' && <CheckCircle className="h-4 w-4" />}
                  <AlertTitle>{feedback.type === 'success' ? 'Sucesso' : 'Erro'}</AlertTitle>
                  <AlertDescription>{feedback.message}</AlertDescription>
              </Alert>
            )}
            {reportData.length === 0 ? (
              <p className="text-center text-green-600 py-4">Nenhuma árvore com seção única encontrada para os filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto max-h-[65vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-24">Nº Roman.</TableHead>
                      <TableHead className="w-16 font-bold text-blue-700">Nº Árv.</TableHead>
                      <TableHead className="w-12 font-bold text-blue-700">Seç. Única</TableHead>
                      <TableHead className="w-40">Espécie</TableHead>
                      <TableHead className="text-right w-20">D1(cm)</TableHead>
                      <TableHead className="text-right w-20">D2(cm)</TableH‌ead>
                      <TableHead className="text-right w-20">C1(m)</TableHead>
                      <TableHead className="text-right w-24">Vol.Com.</TableHead>
                      <TableHead className="text-center w-28">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => {
                      const isEditingThisItem = editingItemId === item.item_id_original;
                      const currentData = isEditingThisItem ? editingItemData : item;
                      const itemIdForActions = item.item_id_original || item.id;
                      const isItemDeleteLoading = deleteActionLoadingItemId === itemIdForActions;
                      
                      let rowClass = "";
                      if (parseInt(item.numero_arvore) % 2 === 0) {
                         rowClass = "bg-blue-50 border-l-4 border-blue-300";
                      } else {
                         rowClass = "bg-blue-100 border-l-4 border-blue-400";
                      }
                      
                      if (isEditingThisItem) {
                        rowClass += " bg-amber-50"; 
                      }
                      
                      return (
                        <TableRow key={item.id} className={rowClass}>
                          <TableCell className="font-medium">{currentData.numero_romaneio}</TableCell>
                          <TableCell className="font-bold text-blue-700">{currentData.numero_arvore}</TableCell>
                          <TableCell className="uppercase font-bold text-blue-700">{currentData.seccao}</TableCell>
                          <TableCell>{currentData.nomeEspecie}</TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? (
                              <Input type="number" step="0.1" value={currentData.diametro1} onChange={(e) => handleEditInlineChange('diametro1', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.0"/>
                            ) : formatarNumero(currentData.diametro1, 1)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? (
                              <Input type="number" step="0.1" value={currentData.diametro2} onChange={(e) => handleEditInlineChange('diametro2', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.0"/>
                            ) : formatarNumero(currentData.diametro2, 1)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? (
                              <Input type="number" step="0.01" value={currentData.comprimento1} onChange={(e) => handleEditInlineChange('comprimento1', e.target.value)} className="h-8 text-xs w-20 text-right" placeholder="0.00"/>
                            ) : formatarNumero(currentData.comprimento1, 2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isEditingThisItem ? formatarNumero(editingItemData.volume_comercial, 4) : formatarNumero(currentData.volume_comercial, 4)}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditingThisItem ? (
                              <div className="flex gap-1 justify-center">
                                <Button variant="ghost" size="icon" onClick={saveEditInline} disabled={editLoading} className="h-8 w-8 hover:bg-green-100" title="Salvar">
                                  {editLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 text-green-600" />}
                                                </Button>
                                <Button variant="ghost" size="icon" onClick={cancelEditInline} disabled={editLoading} className="h-8 w-8 hover:bg-red-100" title="Cancelar">
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1 justify-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => startEditInline({
                                      ...item,
                                      id: item.item_id_original 
                                  })} 
                                  disabled={editLoading || editingItemId || deleteActionLoadingItemId || isDeletingItem} 
                                  className="h-8 w-8 hover:bg-amber-100" 
                                  title="Editar item"
                                >
                                  <Pencil className="h-4 w-4 text-amber-600" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteClick({
                                      ...item,
                                      id: item.item_id_original
                                  })}
                                  disabled={editLoading || editingItemId || deleteActionLoadingItemId || isDeletingItem}
                                  className="h-8 w-8 hover:bg-red-100" 
                                  title="Excluir item"
                                >
                                  {isItemDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin text-red-600"/> : <Trash2 className="h-4 w-4 text-red-600" />}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }
    return <p className="text-center p-4">Tipo de relatório não implementado para visualização.</p>;
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
        <p className="ml-3">Carregando dados iniciais...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="relatorios-page-container">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
            margin: 0;
            padding: 0;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          /* Estilos adicionais para melhorar a impressão da tabela, se necessário */
          #printable-report-area .card-print {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
          #printable-report-area table {
            font-size: 8pt !important; /* Ajuste o tamanho da fonte para impressão */
          }
           #printable-report-area th, #printable-report-area td {
            padding: 3px !important; /* Ajuste o padding para impressão */
          }
        }
      `}</style>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between no-print">
        <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Button onClick={resetFilters} variant="outline" size="sm" title="Limpar Filtros" disabled={loading || editLoading || isDeletingItem || generatingPDF}>
                <RotateCcw className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {pageError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro na Página</AlertTitle>
          <AlertDescription>
            {pageError}
            {(pageError.toLowerCase().includes("muitas solicitações") || pageError.toLowerCase().includes("network error") || pageError.toLowerCase().includes("erro de rede")) && 
              <span className="block mt-2 text-sm">Por favor, verifique sua conexão com a internet ou aguarde alguns minutos e tente novamente.</span>
            }
          </AlertDescription>
        </Alert>
      )}

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center"><Filter className="h-5 w-5 mr-2 text-emerald-600"/> Filtros do Relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reportType">Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={(value) => { setReportType(value); resetFilters(); }} disabled={editLoading || isDeletingItem || generatingPDF}>
                <SelectTrigger id="reportType">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={RELATORIO_TYPES.ESTOQUE_ATUAL_POR_ESPECIE}>Estoque Atual por Espécie</SelectItem>
                  <SelectItem value={RELATORIO_TYPES.FILTRAR_ITENS_DE_ENTRADA}>Filtrar Itens de Entrada (Editável)</SelectItem>
                  <SelectItem value={RELATORIO_TYPES.VERIFICAR_NUMEROS_AUSENTES}>Verificar Números Ausentes</SelectItem>
                  <SelectItem value={RELATORIO_TYPES.VERIFICAR_ARVORES_DUPLICADAS}>Verificar Árvores Duplicadas</SelectItem>
                  <SelectItem value={RELATORIO_TYPES.VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO}>Verificar Inconsistência Espécie/Seção</SelectItem>
                  <SelectItem value={RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA}>Verificar Árvores com Seção Única</SelectItem> {/* Nova opção */}
                </SelectContent>
              </Select>
            </div>
            
            <div>
                <Label htmlFor="filtro_especie_id">Espécie</Label>
                <Select 
                    value={filters.especie_id} 
                    onValueChange={(value) => handleFilterChange("especie_id", value)} 
                    disabled={editLoading || isDeletingItem || generatingPDF}
                >
                    <SelectTrigger id="filtro_especie_id">
                    <SelectValue placeholder="Todas as Espécies" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value={ALL_SPECIES_VALUE}>Todas as Espécies</SelectItem> 
                    {especies.map(esp => (
                        <SelectItem key={esp.id} value={esp.id}>{esp.codigo} - {esp.nome}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
          
          {/* Filtros específicos para Itens de Entrada */}
          {reportType === RELATORIO_TYPES.FILTRAR_ITENS_DE_ENTRADA && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 pt-4 border-t mt-4">
              <div>
                <Label htmlFor="numero_arvore_filtro" className="text-xs">Nº Árvore (Específico)</Label>
                <Input id="numero_arvore_filtro" name="numero_arvore_filtro" type="number" value={filters.numero_arvore_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 123" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF}/>
              </div>
              <div>
                <Label htmlFor="seccao_filtro" className="text-xs">Secção</Label>
                <Input id="seccao_filtro" name="seccao_filtro" value={filters.seccao_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value.toUpperCase())} placeholder="Ex: A" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF}/>
              </div>
              <div>
                <Label htmlFor="diametro1_filtro" className="text-xs">Diâm.1 (cm)</Label>
                <Input id="diametro1_filtro" name="diametro1_filtro" type="text" value={filters.diametro1_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 50.0" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF}/>
              </div>
              <div>
                <Label htmlFor="diametro2_filtro" className="text-xs">Diâm.2 (cm)</Label>
                <Input id="diametro2_filtro" name="diametro2_filtro" type="text" value={filters.diametro2_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 45.5" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF}/>
              </div>
              <div>
                <Label htmlFor="comprimento1_filtro" className="text-xs">Comp.1 (m)</Label>
                <Input id="comprimento1_filtro" name="comprimento1_filtro" type="text" value={filters.comprimento1_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 6.50" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF}/>
              </div>
              <div>
                <Label htmlFor="diametro3_filtro" className="text-xs">Diâm.3 (cm)</Label>
                <Input id="diametro3_filtro" name="diametro3_filtro" type="text" value={filters.diametro3_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 40" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF}/>
              </div>
              <div>
                <Label htmlFor="comprimento2_filtro" className="text-xs">Comp.2 (m)</Label>
                <Input id="comprimento2_filtro" name="comprimento2_filtro" type="text" value={filters.comprimento2_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 5.00" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF}/>
              </div>
            </div>
          )}

          {/* Filtros para Inconsistência OU Seção Única */}
          {(reportType === RELATORIO_TYPES.VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO || reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-4 border-t mt-4">
              <div>
                <Label htmlFor="numero_arvore_filtro" className="text-xs">Nº Árvore (Específico)</Label>
                <Input 
                  id="numero_arvore_filtro" 
                  name="numero_arvore_filtro" 
                  type="number" 
                  value={filters.numero_arvore_filtro} 
                  onChange={(e) => handleFilterChange(e.target.name, e.target.value)} 
                  placeholder="Ex: 123" 
                  className="h-8 text-sm" 
                  disabled={editLoading || isDeletingItem || generatingPDF || (!!filters.intervalo_inicio_inconsistencia_filtro || !!filters.intervalo_fim_inconsistencia_filtro)}
                />
              </div>
              <div>
                <Label htmlFor="intervalo_inicio_inconsistencia_filtro" className="text-xs">Nº Árvore Inicial (Intervalo)</Label>
                <Input 
                  id="intervalo_inicio_inconsistencia_filtro" 
                  name="intervalo_inicio_inconsistencia_filtro" 
                  type="number" 
                  value={filters.intervalo_inicio_inconsistencia_filtro} 
                  onChange={(e) => handleFilterChange(e.target.name, e.target.value)} 
                  placeholder="Ex: 1" 
                  className="h-8 text-sm" 
                  disabled={editLoading || isDeletingItem || generatingPDF || !!filters.numero_arvore_filtro}
                />
              </div>
              <div>
                <Label htmlFor="intervalo_fim_inconsistencia_filtro" className="text-xs">Nº Árvore Final (Intervalo)</Label>
                <Input 
                  id="intervalo_fim_inconsistencia_filtro" 
                  name="intervalo_fim_inconsistencia_filtro" 
                  type="number" 
                  value={filters.intervalo_fim_inconsistencia_filtro} 
                  onChange={(e) => handleFilterChange(e.target.name, e.target.value)} 
                  placeholder="Ex: 100" 
                  className="h-8 text-sm" 
                  disabled={editLoading || isDeletingItem || generatingPDF || !!filters.numero_arvore_filtro}
                />
              </div>
            </div>
          )}

          {reportType === RELATORIO_TYPES.VERIFICAR_NUMEROS_AUSENTES && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-4 border-t mt-4">
              <div>
                <Label htmlFor="intervalo_inicio_filtro" className="text-xs">Nº Árvore Inicial *</Label>
                <Input id="intervalo_inicio_filtro" name="intervalo_inicio_filtro" type="number" value={filters.intervalo_inicio_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 1" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF} required/>
              </div>
              <div>
                <Label htmlFor="intervalo_fim_filtro" className="text-xs">Nº Árvore Final *</Label>
                <Input id="intervalo_fim_filtro" name="intervalo_fim_filtro" type="number" value={filters.intervalo_fim_filtro} onChange={(e) => handleFilterChange(e.target.name, e.target.value)} placeholder="Ex: 100" className="h-8 text-sm" disabled={editLoading || isDeletingItem || generatingPDF} required/>
              </div>
            </div>
          )}
          
          <Button onClick={generateReport} disabled={loading || editLoading || isDeletingItem || generatingPDF} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 mt-4">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <FileText className="h-4 w-4 mr-2" />}
            Gerar Relatório
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 report-output">
        {reportData && (reportType === RELATORIO_TYPES.FILTRAR_ITENS_DE_ENTRADA || reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA) && reportData.length > 0 && (
          <div className="flex justify-end mb-4 no-print">
            <Button 
              onClick={handleGeneratePDFReport} 
              variant="outline" 
              size="sm" 
              disabled={loading || editLoading || isDeletingItem || generatingPDF}
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            >
              {generatingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Download className="h-4 w-4 mr-2" />}
              Baixar PDF do Relatório
            </Button>
          </div>
        )}
        {reportData && (
          <div className="flex justify-end mb-4 no-print">
            <Button onClick={handlePrint} variant="outline" size="sm" disabled={loading || editLoading || isDeletingItem || generatingPDF}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Relatório
            </Button>
          </div>
        )}
        <div id="printable-report-area">
          {(() => {
            const renderedContent = renderReport();
            const needsCardPrintClass = reportData && (
              reportType === RELATORIO_TYPES.ESTOQUE_ATUAL_POR_ESPECIE ||
              reportType === RELATORIO_TYPES.FILTRAR_ITENS_DE_ENTRADA ||
              reportType === RELATORIO_TYPES.VERIFICAR_NUMEROS_AUSENTES ||
              reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_DUPLICADAS ||
              reportType === RELATORIO_TYPES.VERIFICAR_INCONSISTENCIA_ESPECIE_SECAO ||
              reportType === RELATORIO_TYPES.VERIFICAR_ARVORES_COM_SECAO_UNICA 
            );

            // Check if renderedContent is a valid React element and its type is Card (assuming Card has a displayName or is directly referenced)
            if (needsCardPrintClass && React.isValidElement(renderedContent) && renderedContent.type === Card) {
              return React.cloneElement(renderedContent, {
                className: (renderedContent.props.className || '') + ' card-print'
              });
            }
            return renderedContent;
          })()}
        </div>
      </div>
      
      {/* AlertDialog para confirmação de exclusão */}
      {itemToDelete && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600"/>
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o item: <br />
                <strong>Nº Árvore:</strong> {itemToDelete.numero_arvore}, 
                <strong> Seção:</strong> {itemToDelete.seccao}, 
                <strong> Romaneio:</strong> {itemToDelete.numero_romaneio}? <br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setShowDeleteDialog(false); setItemToDelete(null);}} disabled={isDeletingItem}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteItem} 
                disabled={isDeletingItem}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeletingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
