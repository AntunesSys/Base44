
import React, { useState, useEffect, useRef } from "react";
import { Entrada } from "@/api/entities";
import { EntradaItem } from "@/api/entities";
import { Explorador } from "@/api/entities";
import { Romaneador } from "@/api/entities";
import { Especie } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter, // Added for new details view
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Download,
  LogIn,
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  Square,
  Printer,
  UploadCloud,
  Loader2,
  Info,
  X // Added X icon for closing details
} from "lucide-react";
import { format } from "date-fns";
import { Notificacao } from "@/api/entities";
import { CheckCircle } from 'lucide-react';
import ImportItensDialog from "@/components/entradas/ImportItensDialog";
import { SaidaItem } from "@/api/entities";

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
  return parseFloat(volume.toFixed(4)); // Ajustado para 4 casas decimais
};

export default function EntradasPage() {
  // Estados principais
  const [entradas, setEntradas] = useState([]);
  const [entradaItens, setEntradaItens] = useState([]); // Itens de todas as entradas
  const [exploradores, setExploradores] = useState([]);
  const [romaneadores, setRomaneadores] = useState([]);
  const [especies, setEspecies] = useState([]);

  const [loading, setLoading] = useState(true); // Loading geral para a página
  const [loadingDialog, setLoadingDialog] = useState(false); // Loading para ações dentro do diálogo
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(null);
  const [pageError, setPageError] = useState(null); // Erro geral da página
  const [feedback, setFeedback] = useState(null); // Consolidado para mensagens de erro/sucesso/aviso do formulário/diálogo

  // Estado atual da entrada sendo editada/criada
  const [currentEntrada, setCurrentEntrada] = useState({
    numero_registro: "",
    data: new Date().toISOString().split('T')[0], // Mantém o formato YYYY-MM-DD inicial
    explorador_id: "",
    romaneador_id: "",
    volume_florestal_total: 0,
    volume_comercial_total: 0,
    observacoes: ""
  });

  // Estado atual do item sendo adicionado (RENAMED from currentItem to newItem as per outline's implicit suggestion)
  const [newItem, setNewItem] = useState({
    numero_arvore: "",
    seccao: "", // Inicialmente vazio
    especie_id: "",
    especie_codigo: "",
    diametro1: "",
    diametro2: "",
    comprimento1: "",
    volume_florestal: "",
    diametro3: "",
    comprimento2: "",
    volume_comercial: "",
    is_dormente: false
  });

  const [tempItems, setTempItems] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [isImportItensDialogOpen, setIsImportItensDialogOpen] = useState(false);
  const [itemEditLockError, setItemEditLockError] = useState(null);
  const [existingItemsForCurrentEntrada, setExistingItemsForCurrentEntrada] = useState([]); // Para guardar itens já salvos da entrada atual

  // Refs para navegação com Enter
  const numeroArvoreInputRef = useRef(null);
  const especieCodigoInputRef = useRef(null);
  const seccaoInputRef = useRef(null);
  const diametro1InputRef = useRef(null);
  const diametro2InputRef = useRef(null);
  const comprimento1InputRef = useRef(null);
  const diametro3InputRef = useRef(null);
  const comprimento2InputRef = useRef(null);
  const adicionarItemRef = useRef(null); // This one's usage pattern changes slightly in the outline.

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Esta lógica de URL param agora é chamada DENTRO do loadData, após os dados carregarem
    if (!loading && entradas.length > 0 && !isDialogOpen) {
        const urlParams = new URLSearchParams(window.location.search);
        const entradaIdParaEditar = urlParams.get('editarEntradaId');
        if (entradaIdParaEditar) {
            const entradaObj = entradas.find(e => e.id === entradaIdParaEditar);
            if (entradaObj) {
                console.log(`[EntradasPage] Abrindo entrada ${entradaIdParaEditar} via URL param.`);
                handleEdit(entradaObj);
                window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
            } else {
                console.warn(`[EntradasPage] Entrada com ID ${entradaIdParaEditar} (da URL) não encontrada.`);
            }
        }
    }
  }, [loading, entradas, isDialogOpen]);

  // Novo useEffect para carregar itens existentes da entrada selecionada
  useEffect(() => {
    async function loadItemsForSelectedEntrada() {
      // isNewEntrada do outline corresponde a !isEditing
      if (currentEntrada && currentEntrada.id && isEditing) { // Apenas busca se estiver editando uma entrada existente
        setLoadingDialog(true);
        try {
          const items = await EntradaItem.filter({ entrada_id: currentEntrada.id });
          setExistingItemsForCurrentEntrada(items);
        } catch (error) {
          console.error("Erro ao carregar itens existentes para a entrada:", error);
          setFeedback({ type: 'error', message: 'Erro ao carregar itens salvos para esta entrada.' });
          setExistingItemsForCurrentEntrada([]);
        } finally {
          setLoadingDialog(false);
        }
      } else {
        setExistingItemsForCurrentEntrada([]); // Limpar se for nova entrada ou nenhuma selecionada
      }
    }
    loadItemsForSelectedEntrada();
  }, [currentEntrada.id, isEditing]); // Depende do ID da entrada e do estado de edição

  const loadData = async (forceReloadStatic = false) => {
    setLoading(true);
    setPageError(null);
    setItemEditLockError(null);

    let exploradoresData = exploradores;
    let romaneadoresData = romaneadores;
    let especiesData = especies;

    try {
      // Carregar dados estáticos apenas se necessário (primeira carga ou forçado)
      if (forceReloadStatic || exploradores.length === 0) {
        exploradoresData = await Explorador.list();
        setExploradores(exploradoresData);
      }
      if (forceReloadStatic || romaneadores.length === 0) {
        romaneadoresData = await Romaneador.list();
        setRomaneadores(romaneadoresData);
      }
      if (forceReloadStatic || especies.length === 0) {
        especiesData = await Especie.list();
        setEspecies(especiesData);
      }

      // Sempre carregar dados dinâmicos (entradas e seus itens)
      const [entradasFetched, allItensFetched] = await Promise.all([
        Entrada.list('-data'),
        EntradaItem.list(),
      ]);

      setEntradas(entradasFetched);
      setEntradaItens(allItensFetched);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      if (error.response && error.response.status === 429) {
        setPageError("Muitas solicitações ao servidor. Por favor, aguarde alguns minutos e tente recarregar. Se o problema persistir, contate o suporte.");
      } else {
        setPageError(`Erro ao carregar dados: ${error.message || "Verifique sua conexão e tente novamente."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Para o campo de data, o valor do input type="date" já está no formato YYYY-MM-DD
    // Não é necessária conversão especial aqui se a entidade espera YYYY-MM-DD
    setCurrentEntrada(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newPartialItem = {};

    if (type === "checkbox" && name === "is_dormente") {
      newPartialItem.is_dormente = checked;
    } else {
      let processedValue = value;
      if (name === "numero_arvore") {
        processedValue = value.replace(/\D/g, '');
      } else if (name === "seccao") {
        processedValue = value.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase();
      } else if (["diametro1", "diametro2", "diametro3", "comprimento1", "comprimento2"].includes(name)) {
        // Permite números e ponto/vírgula, remove outros caracteres não numéricos exceto sinal negativo no início (opcional)
        processedValue = value.replace(/[^0-9.,]/g, '');
      } else if (name === "especie_codigo") {
        processedValue = value.toUpperCase(); // Códigos de espécie geralmente são maiúsculos
      }
      newPartialItem[name] = processedValue;
    }

    setNewItem(prevNewItem => {
      const updatedItemState = { ...prevNewItem, ...newPartialItem };

      if (name === "especie_codigo" && newPartialItem.especie_codigo !== undefined) {
          const especieEncontrada = especies.find(esp => esp.codigo?.toUpperCase() === newPartialItem.especie_codigo?.toUpperCase());
          if (especieEncontrada) {
              updatedItemState.especie_id = especieEncontrada.id;
          } else {
              updatedItemState.especie_id = ""; // Limpa ID se código não corresponde
          }
      }
      
      // Recalcula volumes se um campo relevante para cálculo de volume mudou
      if (["diametro1", "diametro2", "comprimento1", "diametro3", "comprimento2"].some(fieldName => fieldName in newPartialItem) || name === "especie_codigo") {
          const d1_val = parseFloat(String(updatedItemState.diametro1).replace(',', '.'));
          const d2_val = parseFloat(String(updatedItemState.diametro2).replace(',', '.'));
          const c1_val = parseFloat(String(updatedItemState.comprimento1).replace(',', '.'));
          const d3_val = parseFloat(String(updatedItemState.diametro3).replace(',', '.'));
          const c2_val = parseFloat(String(updatedItemState.comprimento2).replace(',', '.'));

          // Volume Florestal: usa D1, D2 e C1
          let volFlor = 0;
          if (!isNaN(d1_val) && !isNaN(d2_val) && !isNaN(c1_val) && d1_val > 0 && d2_val > 0 && c1_val > 0) {
              volFlor = calcularVolume(d1_val, d2_val, c1_val);
          }

          // Volume Comercial: usa diâmetro efetivo e comprimento efetivo
          let volCom = 0;
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
            volCom = calcularVolume(diametro_efetivo, diametro_efetivo, comprimento_efetivo);
          }

          updatedItemState.volume_florestal = volFlor.toFixed(4); // Ajustado para 4 casas decimais
          updatedItemState.volume_comercial = volCom.toFixed(4); // Ajustado para 4 casas decimais
      }
      return updatedItemState;
    });
  };

  const handleEspecieCodigoBlur = () => { // Nova função para o onBlur do Cód. Espécie
    const especieEncontrada = especies.find(esp => esp.codigo?.toUpperCase() === newItem.especie_codigo?.toUpperCase());
    if (especieEncontrada && seccaoInputRef.current) {
      seccaoInputRef.current.focus();
    }
  };

  const handleKeyPress = (e, nextFieldRefOrAction) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevenir comportamento padrão do Enter (ex: submeter form)
      
      const currentField = e.target.name;

      // Se o campo atual for 'especie_codigo' e uma espécie for encontrada, mover para seção
      if (currentField === "especie_codigo") {
        const especieEncontrada = especies.find(esp => esp.codigo?.toUpperCase() === newItem.especie_codigo?.toUpperCase());
        if (especieEncontrada && seccaoInputRef.current) {
          seccaoInputRef.current.focus();
          return; // Não processar 'nextFieldRefOrAction' se já moveu o foco
        }
      }

      if (typeof nextFieldRefOrAction === 'string' && nextFieldRefOrAction === 'submit') {
        handleAddItem(); 
      } else if (nextFieldRefOrAction && nextFieldRefOrAction.current) {
        if (typeof nextFieldRefOrAction.current.focus === 'function') {
          nextFieldRefOrAction.current.focus();
        }
        else if (nextFieldRefOrAction.current.querySelector('input, button')) {
          nextFieldRefOrAction.current.querySelector('input, button').focus();
        }
      }
    }
  };

  const handleEspecieChange = (codigoOuId, tipo = 'codigo') => {
    let especie;
    if (tipo === 'codigo') {
        especie = especies.find(esp => esp.codigo?.toLowerCase() === codigoOuId?.toLowerCase());
    } else { // tipo === 'id'
        especie = especies.find(esp => esp.id === codigoOuId);
    }

    if (especie) {
      setNewItem(prev => ({ // Changed from setCurrentItem to setNewItem
        ...prev,
        especie_id: especie.id,
        especie_codigo: especie.codigo,
      }));
      // Tenta focar na secção após seleção/digitação de espécie
      if (seccaoInputRef.current) {
        seccaoInputRef.current.focus();
      }
    } else if (tipo === 'codigo') { // Se digitou um código que não existe
       setNewItem(prev => ({ // Changed from setCurrentItem to setNewItem
        ...prev,
        especie_id: "",
        especie_codigo: codigoOuId,
      }));
    }
  };

  const handleSelectChange = (field, value) => {
    if (field === "especie_id") {
      setNewItem(prev => ({ // Changed from setCurrentItem to setNewItem
        ...prev,
        [field]: value
      }));
    } else {
      setCurrentEntrada(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Nova função para encapsular a lógica de adicionar o item
  const proceedWithAddItem = () => {
    const d1_val = parseFloat(String(newItem.diametro1).replace(',', '.'));
    const d2_val = parseFloat(String(newItem.diametro2).replace(',', '.'));
    const c1_val = parseFloat(String(newItem.comprimento1).replace(',', '.'));
    const d3_raw = newItem.diametro3 ? String(newItem.diametro3).replace(',', '.') : null;
    const c2_raw = newItem.comprimento2 ? String(newItem.comprimento2).replace(',', '.') : null;

    const d3_val = d3_raw ? parseFloat(d3_raw) : null;
    const c2_val = c2_raw ? parseFloat(c2_raw) : null;

    const vol_florestal = calcularVolume(d1_val, d2_val, c1_val);

    let vol_comercial = 0;
    let diametro_efetivo_com = null;
    let comprimento_efetivo_com = null;

    if (d3_val && d3_val > 0) diametro_efetivo_com = d3_val;
    else if (d2_val && d2_val > 0) diametro_efetivo_com = d2_val;

    if (c2_val && c2_val > 0) comprimento_efetivo_com = c2_val;
    else if (c1_val && c1_val > 0) comprimento_efetivo_com = c1_val;

    if (diametro_efetivo_com !== null && comprimento_efetivo_com !== null) {
        vol_comercial = calcularVolume(diametro_efetivo_com, diametro_efetivo_com, comprimento_efetivo_com);
    }

    const especieInfo = especies.find(e => e.id === newItem.especie_id);

    const itemToAdd = {
      ...newItem, // Preserves other fields from newItem state
      id: editingItemId || `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // Use editingItemId if editing
      numero_arvore: String(newItem.numero_arvore),
      seccao: newItem.seccao.toUpperCase(),
      especie_id: newItem.especie_id,
      especie_codigo: especieInfo?.codigo || newItem.especie_codigo || '', // Keep typed code if species not found
      especie_nome: especieInfo?.nome || 'Espécie não encontrada',
      diametro1: String(d1_val), // Store as string but ensure it's a valid number
      diametro2: String(d2_val),
      comprimento1: String(c1_val),
      diametro3: d3_val ? String(d3_val) : "",
      comprimento2: c2_val ? String(c2_val) : "",
      volume_florestal: vol_florestal.toFixed(4),
      volume_comercial: vol_comercial.toFixed(4),
      is_dormente: !!newItem.is_dormente,
    };

    let updatedTempItems;
    if (isEditingItem && editingItemId) {
      updatedTempItems = tempItems.map(item => item.id === editingItemId ? itemToAdd : item);
      setIsEditingItem(false);
      setEditingItemId(null);
    } else {
      updatedTempItems = [itemToAdd, ...tempItems]; // Add new item to the top
    }
    setTempItems(updatedTempItems);
    recalcularTotais(updatedTempItems);

    const especieIdToRetain = newItem.especie_id;
    const especieCodeToRetain = newItem.especie_codigo;

    setNewItem({ // Changed from setCurrentItem to setNewItem
      numero_arvore: "",
      seccao: "",
      especie_id: especieIdToRetain,
      especie_codigo: especieCodeToRetain,
      diametro1: "",
      diametro2: "",
      comprimento1: "",
      volume_florestal: "",
      diametro3: "",
      comprimento2: "",
      volume_comercial: "",
      is_dormente: false
    });

    if (numeroArvoreInputRef.current) {
      numeroArvoreInputRef.current.focus();
    }
  };

  // Renamed from addTempItem to handleAddItem, incorporating outline logic
  const handleAddItem = async () => {
    setFeedback(null); // Clear all previous feedback
    setItemEditLockError(null); // Ensure this is also cleared

    const { numero_arvore, seccao, especie_id, diametro1, diametro2, comprimento1, diametro3, comprimento2 } = newItem;

    // --- Validation ---
    if (!numero_arvore || !especie_id || !seccao ||
        !diametro1 || !diametro2 || !comprimento1) {
      const missingFields = [];
      if (!numero_arvore) missingFields.push("Árvore");
      if (!especie_id) missingFields.push("Espécie (via Cód. Espécie)");
      if (!seccao) missingFields.push("Secção");
      if (!diametro1) missingFields.push("Diâm.1");
      if (!diametro2) missingFields.push("Diâm.2");
      if (!comprimento1) missingFields.push("Comp.1");
      setFeedback({ type: 'error', message: `Preencha os campos obrigatórios: ${missingFields.join(', ')}.` });
      return;
    }

    if (seccao.length !== 1 || !/^[A-Z]$/i.test(seccao)) {
      setFeedback({ type: 'error', message: `O campo Secção ('${seccao}') deve conter uma única letra (A-Z).` });
      if (seccaoInputRef.current) {
        seccaoInputRef.current.focus();
      }
      return;
    }

    const d1_val = parseFloat(String(diametro1).replace(',', '.'));
    const d2_val = parseFloat(String(diametro2).replace(',', '.'));
    const c1_val = parseFloat(String(comprimento1).replace(',', '.'));
    const d3_raw = diametro3 ? String(diametro3).replace(',', '.') : null;
    const c2_raw = comprimento2 ? String(comprimento2).replace(',', '.') : null;

    const d3_val = d3_raw ? parseFloat(d3_raw) : null;
    const c2_val = c2_raw ? parseFloat(c2_raw) : null;

    if (isNaN(d1_val) || d1_val <= 0 || isNaN(d2_val) || d2_val <= 0 || isNaN(c1_val) || c1_val <= 0) {
        setFeedback({type: 'error', message: "Valores inválidos para diâmetros ou comprimento 1 (devem ser números positivos)."});
        return;
    }
    if ((d3_val !== null && (isNaN(d3_val) || d3_val <= 0)) || (c2_val !== null && (isNaN(c2_val) || c2_val <= 0))) {
        setFeedback({type: 'error', message: "Valores inválidos para diâmetro 3 ou comprimento 2 (devem ser números positivos), se fornecidos."});
        return;
    }

    // Combine current temporary items and items existing in DB for the current entry
    const allCurrentItems = [
        ...tempItems,
        ...(isEditing ? existingItemsForCurrentEntrada : [])
    ];

    // When editing an item, we exclude the item itself from the combined list for duplication/inconsistency check
    const itemsToCheckAgainst = editingItemId
        ? allCurrentItems.filter(item => item.id !== editingItemId)
        : allCurrentItems;

    // 1. Verificar Duplicidade (mesmo número de árvore E mesma seção)
    const isDuplicate = itemsToCheckAgainst.some(
      (item) =>
        String(item.numero_arvore) === String(numero_arvore) &&
        item.seccao?.toUpperCase() === seccao.toUpperCase()
    );

    if (isDuplicate) {
      setFeedback({
        type: 'error',
        message: `Item duplicado: Árvore Nº ${numero_arvore}, Seção ${seccao.toUpperCase()} já existe nesta entrada.`,
      });
      return;
    }

    // 2. Verificar Inconsistência de Espécie (mesmo número de árvore, mas espécie diferente de outras seções)
    const itemsOfSameTree = itemsToCheckAgainst.filter(
      (item) => String(item.numero_arvore) === String(numero_arvore)
    );

    if (itemsOfSameTree.length > 0) {
      const existingEspecieIdForTree = itemsOfSameTree[0].especie_id;
      if (especie_id !== existingEspecieIdForTree) {
        const newEspecieInfo = especies.find(e => e.id === especie_id);
        const existingEspecieInfo = especies.find(e => e.id === existingEspecieIdForTree);
        setFeedback({
          type: 'warning',
          message: `Inconsistência de espécie: Árvore Nº ${numero_arvore} já possui seções cadastradas como "${existingEspecieInfo?.nome || 'Desconhecida'}". Você está tentando adicionar a Seção ${seccao.toUpperCase()} como "${newEspecieInfo?.nome || 'Desconhecida'}".`,
          onConfirm: () => {
            setFeedback(null); // Clear the warning feedback
            proceedWithAddItem(); // Proceed with adding the item
          }
        });
        return; // Stop here, user must confirm through the warning
      }
    }

    // If all checks pass and no warning requires confirmation, proceed directly
    proceedWithAddItem();
  };

  const recalcularTotais = (itemsList) => { // Renomeado para evitar confusão com estado `tempItems`
    let volumeFlorestalTotal = 0;
    let volumeComercialTotal = 0;

    itemsList.forEach(item => {
      volumeFlorestalTotal += parseFloat(item.volume_florestal || 0);
      volumeComercialTotal += parseFloat(item.volume_comercial || 0);
    });

    // Atualiza o estado da entrada com os novos totais
    setCurrentEntrada(prev => ({
      ...prev,
      volume_florestal_total: parseFloat(volumeFlorestalTotal.toFixed(4)), // Ajustado para 4 casas decimais
      volume_comercial_total: parseFloat(volumeComercialTotal.toFixed(4)) // Ajustado para 4 casas decimais
    }));
  };

  const handleImportItensSuccess = (itensImportadosDoDialog) => {
    console.log("[EntradasPage] handleImportItensSuccess: Recebidos itens do diálogo:", itensImportadosDoDialog);
    if (!Array.isArray(itensImportadosDoDialog)) {
        console.error("[EntradasPage] handleImportItensSuccess: itensImportadosDoDialog não é um array.");
        setFeedback({type: "error", message: "Erro ao processar itens importados: formato inválido."});
        return;
    }

    const novosItensParaTemp = itensImportadosDoDialog.map(item => ({
      ...item,
      // O ID temporário é crucial para a UI poder identificar unicamente cada item na lista tempItems
      // antes de serem salvos no banco (onde receberão IDs permanentes).
      id: `temp_imported_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      numero_arvore: String(item.numero_arvore),
      seccao: String(item.seccao).toUpperCase(),
      diametro1: String(item.diametro1),
      diametro2: String(item.diametro2),
      comprimento1: String(item.comprimento1),
      diametro3: item.diametro3 ? String(item.diametro3) : "",
      comprimento2: item.comprimento2 ? String(item.comprimento2) : "",
      volume_florestal: String(parseFloat(item.volume_florestal || 0).toFixed(4)),
      volume_comercial: String(parseFloat(item.volume_comercial || 0).toFixed(4)),
      is_dormente: !!item.is_dormente,
      especie_nome: especies.find(e => e.id === item.especie_id)?.nome || 'Desconhecida',
      especie_codigo: especies.find(e => e.id === item.especie_id)?.codigo || item.especie_codigo || 'N/A'
    }));

    setTempItems(prevTempItems => {
      const mergedItems = [...prevTempItems, ...novosItensParaTemp];
      recalcularTotais(mergedItems);
      return mergedItems;
    });

    setIsImportItensDialogOpen(false);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null); // Limpar feedback antes de tentar submeter

    if (!currentEntrada.numero_registro || !currentEntrada.data ||
        !currentEntrada.explorador_id || !currentEntrada.romaneador_id) {
      setFeedback({type: "error", message: "Preencha todos os campos obrigatórios da entrada."});
      return;
    }

    if (tempItems.length === 0 && !isEditing) {
      setFeedback({type: "error", message: "Adicione pelo menos um item na entrada."});
      return;
    }

    setLoadingDialog(true); // Usar loading específico do diálogo
    try {
      let entradaId;

      let finalVolumeFlorestalTotal = 0;
      let finalVolumeComercialTotal = 0;
      tempItems.forEach(item => {
        finalVolumeFlorestalTotal += parseFloat(item.volume_florestal || 0);
        finalVolumeComercialTotal += parseFloat(item.volume_comercial || 0);
      });

      // A data já deve estar no formato YYYY-MM-DD do input
      // Não converter para objeto Date antes de enviar para o backend.
      const entradaPayload = {
        ...currentEntrada,
        volume_florestal_total: parseFloat(finalVolumeFlorestalTotal.toFixed(4)), // Ajustado para 4 casas decimais
        volume_comercial_total: parseFloat(finalVolumeComercialTotal.toFixed(4)), // Ajustado para 4 casas decimais
      };
      // console.log("Payload da Entrada para salvar:", JSON.stringify(entradaPayload, null, 2)); // Para depuração

      if (isEditing) { // Editando
        const { id, ...dataToUpdate } = entradaPayload;
        await Entrada.update(id, dataToUpdate);
        entradaId = id;

        const itensRealmenteParaDeletar = itemsToDelete.filter(itemId => typeof itemId === 'string' && !itemId.startsWith('temp_'));
        if (itensRealmenteParaDeletar.length > 0) {
          for (const itemId of itensRealmenteParaDeletar) {
            await EntradaItem.delete(itemId);
          }
        }
        setItemsToDelete([]);

        const itensParaAtualizar = [];
        const itensParaCriarNovos = [];
        const existingItemIdsInDb = entradaItens.filter(ei => ei.entrada_id === entradaId).map(ei => ei.id);


        for (const tempItem of tempItems) {
          const { id: tempId, especie_nome, especie_codigo, ...itemDataToSave } = tempItem;
          // Certificar que volumes são float antes de enviar para a API
          const payload = {
            ...itemDataToSave,
            entrada_id: entradaId,
            volume_florestal: parseFloat(itemDataToSave.volume_florestal),
            volume_comercial: parseFloat(itemDataToSave.volume_comercial),
          };

          if (typeof tempId === 'string' && !tempId.startsWith('temp_') && existingItemIdsInDb.includes(tempId)) {
            itensParaAtualizar.push({ id: tempId, data: payload });
          } else {
            itensParaCriarNovos.push(payload);
          }
        }

        if (itensParaAtualizar.length > 0) {
          for (const itemToUpdate of itensParaAtualizar) { // Idealmente, usar bulkUpdate se disponível
            await EntradaItem.update(itemToUpdate.id, itemToUpdate.data);
          }
        }
        if (itensParaCriarNovos.length > 0) {
          try {
            await EntradaItem.bulkCreate(itensParaCriarNovos);
          } catch (bulkCreateError) {
            addLogToState(`Erro no bulkCreate em modo de edição: ${bulkCreateError.message}. Tentando individualmente...`);
            let errosNaCriacaoIndividual = [];
            for (const itemPayload of itensParaCriarNovos) {
              try {
                await EntradaItem.create(itemPayload);
              } catch (itemError) {
                errosNaCriacaoIndividual.push(`Item (Árvore ${itemPayload.numero_arvore}/${itemPayload.seccao}): ${itemError.message || 'Erro desconhecido'}`);
              }
            }
            if (errosNaCriacaoIndividual.length > 0) {
              throw new Error(`Falha ao criar ${errosNaCriacaoIndividual.length} novos itens durante a edição. Detalhes: ${errosNaCriacaoIndividual.join('; ')}`);
            }
          }
        }

      } else { // Criando uma nova entrada
        const newEntrada = await Entrada.create(entradaPayload);
        entradaId = newEntrada.id;

        if (tempItems.length > 0) {
            const itensParaCriar = tempItems.map(item => {
                const { id, especie_nome, especie_codigo, ...itemData } = item;
                return {
                  ...itemData,
                  entrada_id: entradaId,
                  volume_florestal: parseFloat(itemData.volume_florestal), // Certificar que volumes são float
                  volume_comercial: parseFloat(itemData.volume_comercial), // Certificar que volumes são float
                };
            });

            if (itensParaCriar.length > 0) {
                try {
                    await EntradaItem.bulkCreate(itensParaCriar);
                } catch (bulkError) {
                    addLogToState(`Erro ao usar bulkCreate para entrada ${entradaId}: ${bulkError.message}. Tentando criação individual...`);
                    let errosNaCriacaoDeItens = [];
                    for (const itemPayload of itensParaCriar) {
                        try {
                            await EntradaItem.create(itemPayload);
                        } catch (itemError) {
                            errosNaCriacaoDeItens.push(`Item (Árvore ${itemPayload.numero_arvore}/${itemPayload.seccao}): ${itemError.message || 'Erro desconhecido'}`);
                        }
                    }
                    if (errosNaCriacaoDeItens.length > 0) {
                         throw new Error(`Falha ao criar ${errosNaCriacaoDeItens.length} itens. Detalhes: ${errosNaCriacaoDeItens.join('; ')}`);
                    }
                }
            }
        }
      }

      setIsDialogOpen(false);
      resetForm();
      await loadData();

      // Para a NOTIFICAÇÃO, formatamos a data para exibição.
      // A string currentEntrada.data (ex: "2025-05-27") precisa ser exibida como "27/05/2025".
      // Adicionar 'T00:00:00' à string YYYY-MM-DD geralmente faz `new Date()` interpretá-la
      // como meia-noite na hora local, o que é o comportamento desejado para datas.
      
      let dataNotificacao = currentEntrada.data; // Default para caso algo dê errado na formatação
      try {
        const dateObjectForDisplay = new Date(currentEntrada.data + 'T00:00:00');
        dataNotificacao = format(dateObjectForDisplay, 'dd/MM/yyyy');
      } catch (formatError) {
        console.error("Erro ao formatar data para notificação:", formatError);
        // Se falhar, usar a data no formato YYYY-MM-DD ou reverter para dd/MM/yyyy manual
        const parts = currentEntrada.data.split('-');
        if (parts.length === 3) {
          dataNotificacao = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      
      const explorador = exploradores.find(e => e.id === entradaPayload.explorador_id);
      await Notificacao.create({
        titulo: isEditing ? "Entrada Atualizada" : "Nova Entrada Cadastrada",
        mensagem: `${isEditing ? 'Atualizado' : 'Cadastrado'} romaneio ${entradaPayload.numero_registro} (Exp: ${explorador?.nome || ''}, Data: ${dataNotificacao}) com ${tempItems.length} árvores, total ${parseFloat(entradaPayload.volume_comercial_total).toFixed(4)}m³.`, // Ajustado para 4 casas decimais
        data: new Date().toISOString(), // Data da notificação é sempre a atual
        tipo: "informacao",
        lida: false
      });
      setFeedback({ type: "success", message: `Romaneio ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!` });

    } catch (error) {
      console.error("Erro ao salvar entrada:", error);
      let errorMessage = error.message || 'Verifique os dados e tente novamente.';

      if (error.response && error.response.status === 429) {
        errorMessage = "Muitas solicitações ao servidor ao salvar. Por favor, aguarde um momento e tente novamente. Se o problema persistir com muitos itens, contate o suporte.";
      } else if (error.message && error.message.toLowerCase().includes("unique constraint failed")) {
        errorMessage = `Falha ao salvar: Já existe um registro com informações duplicadas (Ex: Número do Romaneio '${currentEntrada.numero_registro}' pode já existir). Verifique os dados.`;
      } else if (error.response && error.response.data && error.response.data.detail) {
        // Tratar erro específico do backend se houver
        if (typeof error.response.data.detail === 'string' && error.response.data.detail.includes("Entrada_numero_registro_key")) {
            errorMessage = `Já existe uma entrada com o Número de Romaneio '${currentEntrada.numero_registro}'. Por favor, utilize outro número.`;
        } else if (typeof error.response.data.detail === 'string') {
            errorMessage = error.response.data.detail;
        }
      } else if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      const technicalDetails = error.stack || (error.response ? JSON.stringify(error.response.data) : 'N/A');
      setFeedback({type: "error", message: `Erro ao salvar entrada: ${errorMessage}. Detalhes técnicos: ${technicalDetails}`});
      addLogToState(`ERRO handleSubmit: ${errorMessage} | Detalhes: ${technicalDetails}`);
    } finally {
      setLoadingDialog(false); // Finalizar loading do diálogo
    }
  };

  const handleViewDetails = async (entrada) => {
    // Os itens já estão carregados em `entradaItens`, apenas filtrar para a entrada selecionada.
    if (detailsVisible === entrada.id) {
      setDetailsVisible(null);
    } else {
      setDetailsVisible(entrada.id);
    }
  };

  const generatePDFForEntrada = (entrada) => {
    // Função para gerar PDF de uma entrada já salva
    const itensDaEntrada = entradaItens.filter(item => item.entrada_id === entrada.id);

    if (itensDaEntrada.length === 0) {
      alert("Esta entrada não possui itens para gerar o romaneio.");
      return;
    }

    // Agrupar itens por espécie
    const itensPorEspecie = {};
    itensDaEntrada.forEach(item => {
      const especie = getEspecie(item.especie_id);
      const especieKey = especie?.codigo || 'N/A';
      if (!itensPorEspecie[especieKey]) {
        itensPorEspecie[especieKey] = {
          codigo: especie?.codigo || 'N/A',
          nome: especie?.nome || 'Desconhecida',
          itens: [],
          totalVolFlor: 0,
          totalVolCom: 0
        };
      }
      itensPorEspecie[especieKey].itens.push({
        ...item,
        especie_codigo: especie?.codigo || 'N/A',
        especie_nome: especie?.nome || 'Desconhecida'
      });
      itensPorEspecie[especieKey].totalVolFlor += parseFloat(item.volume_florestal || 0);
      itensPorEspecie[especieKey].totalVolCom += parseFloat(item.volume_comercial || 0);
    });

    // Criar nova janela para impressão
    const printWindow = window.open('', '_blank');

    const formatVolume = (num) => parseFloat(num).toLocaleString('pt-BR', {minimumFractionDigits: 4, maximumFractionDigits: 4}); // Ajustado para 4 casas decimais
    const formatMedida = (num) => parseFloat(num).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const explorador = getExplorador(entrada.explorador_id);
    const romaneador = getRomaneador(entrada.romaneador_id);

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Romaneio de Entrada ${entrada.numero_registro}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.2;
          margin: 0;
          padding: 0;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        .company-info h1 {
          font-size: 18px;
          font-weight: bold;
          margin: 0;
          color: #2d5016;
        }
        .company-info p {
          margin: 2px 0;
          font-size: 10px;
        }
        .romaneio-info {
          text-align: right;
          font-size: 10px;
        }
        .romaneio-info p {
          margin: 2px 0;
        }
        .details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 15px;
          font-size: 10px;
        }
        .details p {
          margin: 3px 0;
        }
        .species-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .species-header {
          background-color: #f0f0f0;
          padding: 5px;
          font-weight: bold;
          border: 1px solid #ccc;
          margin-bottom: 5px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
          margin-bottom: 10px;
        }
        .items-table th,
        .items-table td {
          border: 1px solid #ccc;
          padding: 3px 5px;
          text-align: center;
        }
        .items-table th {
          background-color: #e8e8e8;
          font-weight: bold;
          font-size: 8px;
        }
        .items-table .text-left { text-align: left; }
        .items-table .text-right { text-align: right; }
        .species-total {
          background-color: #f9f9f9;
          font-weight: bold;
          border-top: 2px solid #333;
        }
        .grand-total {
          margin-top: 15px;
          padding: 10px;
          background-color: #e8f5e8;
          border: 2px solid #2d5016;
          text-align: center;
          font-weight: bold;
          font-size: 12px;
        }
        .dormente-mark {
          color: #dc2626;
          font-weight: bold;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>RGPW</h1>
          <p>Fazenda Esperança / Sistema de Controle Florestal</p>
        </div>
        <div class="romaneio-info">
          <p>${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
          <p><strong>Romaneio nº: ${entrada.numero_registro}</strong></p>
          <p><strong>Data Romaneio: ${new Date(entrada.data + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></p>
        </div>
      </div>

      <div class="details">
        <div>
          <p><strong>Cliente/Origem:</strong> ${explorador?.nome || 'N/A'}</p>
          <p><strong>Motorista:</strong> ENTRADA - FAZ. ESPERANÇA</p>
        </div>
        <div>
          <p><strong>Romaneador:</strong> ${romaneador?.nome || 'N/A'}</p>
          ${entrada.observacoes ? `<p><strong>Observações:</strong> ${entrada.observacoes}</p>` : ''}
        </div>
      </div>

      ${Object.entries(itensPorEspecie).map(([especieKey, especieData]) => `
        <div class="species-section">
          <div class="species-header">
            ${especieData.codigo} - ${especieData.nome}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 8%">Número</th>
                <th style="width: 6%">Sec.</th>
                <th style="width: 8%">D_1</th>
                <th style="width: 8%">D_2</th>
                <th style="width: 8%">Comp.</th>
                <th style="width: 10%">Volume</th>
                <th style="width: 8%">Diâmetro</th>
                <th style="width: 8%">Comp.</th>
                <th style="width: 10%">Volume Com.</th>
                <th style="width: 8%">Obs.</th>
              </tr>
              <tr style="font-size: 7px; color: #666;">
                <th></th>
                <th></th>
                <th colspan="4">Cadeia de Custódia</th>
                <th colspan="3">Comercial</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${especieData.itens.map(item => `
                <tr>
                  <td>${item.numero_arvore}</td>
                  <td style="font-weight: bold; text-transform: uppercase;">${item.seccao}</td>
                  <td>${item.diametro1}</td>
                  <td>${item.diametro2}</td>
                  <td class="text-right">${formatMedida(item.comprimento1)}</td>
                  <td class="text-right">${formatVolume(item.volume_florestal)}</td>
                  <td>${item.diametro3 || item.diametro2}</td>
                  <td class="text-right">${formatMedida(item.comprimento2 || item.comprimento1)}</td>
                  <td class="text-right">${formatVolume(item.volume_comercial)}</td>
                  <td class="dormente-mark">${item.is_dormente ? 'DORMENTE' : ''}</td>
                </tr>
              `).join('')}
              <tr class="species-total">
                <td colspan="5" class="text-right"><strong>TOTAL ${especieData.codigo}:</strong></td>
                <td class="text-right"><strong>${formatVolume(especieData.totalVolFlor)}</strong></td>
                <td colspan="2"></td>
                <td class="text-right"><strong>${formatVolume(especieData.totalVolCom)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      `).join('')}

      <div class="grand-total">
        <p>TOTAL GERAL: ${formatVolume(entrada.volume_florestal_total)} m³ (Florestal) | ${formatVolume(entrada.volume_comercial_total)} m³ (Comercial)</p>
        <p>Quantidade de Árvores: ${itensDaEntrada.length} | Quantidade de Espécies: ${Object.keys(itensPorEspecie).length}</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleEditItem = async (itemId) => {
    setItemEditLockError(null); // Limpar erro de bloqueio anterior
    const itemParaEditar = tempItems.find(item => item.id === itemId);
    if (itemParaEditar) {
      // VERIFICAÇÃO: Se o item já tem saída, não permitir edição
      if (itemParaEditar.id && typeof itemParaEditar.id === 'string' && !itemParaEditar.id.startsWith('temp_')) {
        setLoadingDialog(true); // Usar loading do diálogo para esta verificação
        try {
          const saidasDoItem = await SaidaItem.filter({ entrada_item_id: itemParaEditar.id });
          if (saidasDoItem.length > 0) {
            setItemEditLockError(`O item Árvore ${itemParaEditar.numero_arvore} / Secção ${itemParaEditar.seccao} não pode ser editado pois já possui ${saidasDoItem.length} registro(s) de saída associado(s).`);
            setIsEditingItem(false);
            setEditingItemId(null);
            // Opcional: limpar newItem para que o formulário não mostre dados antigos
            setNewItem({
              numero_arvore: "", seccao: "", especie_id: "", especie_codigo: "",
              diametro1: "", diametro2: "", comprimento1: "", volume_florestal: "",
              diametro3: "", comprimento2: "", volume_comercial: "", is_dormente: false
            });
            return; // Bloqueia a edição
          }
        } catch (err) {
          console.error("Erro ao verificar saídas do item:", err);
          if (err.response && err.response.status === 429) {
            setFeedback({type: "error", message: "Muitas solicitações ao verificar status do item. Tente novamente em breve."});
          } else {
            setFeedback({type: "error", message: "Erro ao verificar status do item. Não foi possível iniciar a edição."});
          }
          return;
        } finally {
            setLoadingDialog(false);
        }
      }

      console.log("[handleEditItem] Editing item:", JSON.stringify(itemParaEditar));
      setNewItem({ ...itemParaEditar });
      setIsEditingItem(true);
      setEditingItemId(itemId);
      if (numeroArvoreInputRef.current) {
        numeroArvoreInputRef.current.focus();
      }
    } else {
      console.error("[handleEditItem] Item not found for ID:", itemId);
    }
  };

  const handleEdit = async (entrada) => {
    setCurrentEntrada(entrada);
    setIsEditing(true);
    setItemsToDelete([]);
    setItemEditLockError(null); // Limpar ao abrir um novo romaneio para edição
    setFeedback(null); // Limpar feedback do formulário

    setLoadingDialog(true); // Start loading dialog
    try {
        const itensDaEntradaDb = await EntradaItem.filter({ entrada_id: entrada.id });

        const tempItemsWithDetails = await Promise.all(
          itensDaEntradaDb.map(async (item) => {
            const especieObj = especies.find(e => e.id === item.especie_id);
            return {
              ...item,
              id: item.id, // Garante que o ID do banco seja usado
              especie_nome: especieObj ? especieObj.nome : "Desconhecido",
              especie_codigo: especieObj ? especieObj.codigo : "N/A",
              // Certificar que os volumes carregados do DB estão com a precisão correta para o estado.
              // Já que a função calcularVolume retorna 4 casas, manter consistência no estado.
              volume_florestal: parseFloat(item.volume_florestal).toFixed(4),
              volume_comercial: parseFloat(item.volume_comercial).toFixed(4),
            };
          })
        );

        setTempItems(tempItemsWithDetails);
        recalcularTotais(tempItemsWithDetails); // Recalcular com os itens carregados
        setIsDialogOpen(true);
    } catch (error) {
        console.error("Erro ao carregar itens da entrada para edição:", error);
        setFeedback({type: "error", message: `Erro ao carregar itens para edição: ${error.message || "Verifique sua conexão."}`});
    } finally {
        setLoadingDialog(false); // End loading dialog
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta entrada?")) {
      try {
        setLoading(true); // Use global loading for main list action
        // Excluir todos os itens relacionados ANTES de excluir a entrada
        const itensParaDeletar = await EntradaItem.filter({ entrada_id: id });
        for (const item of itensParaDeletar) {
          await EntradaItem.delete(item.id);
        }

        // Excluir a entrada
        await Entrada.delete(id);
        loadData(); // Recarrega entradas e seus itens
      } catch (error) {
        console.error("Erro ao excluir entrada:", error);
        setPageError("Erro ao excluir entrada. Por favor, tente novamente."); // Changed from setError
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteItem = (itemId) => {
    // Se o item existir no banco (não é um ID temporário)
    if (typeof itemId === 'string' && !itemId.startsWith('temp_')) {
      setItemsToDelete(prev => [...prev, itemId]);
    }
    // Remover do estado tempItems de qualquer maneira
    const novosItens = tempItems.filter(item => item.id !== itemId);
    setTempItems(novosItens);
    recalcularTotais(novosItens);
  };

  const resetForm = () => {
    setCurrentEntrada({
      numero_registro: "",
      data: new Date().toISOString().split('T')[0],
      explorador_id: "",
      romaneador_id: "",
      volume_florestal_total: 0,
      volume_comercial_total: 0,
      observacoes: ""
    });
    setNewItem({ // Changed from setCurrentItem to setNewItem
      numero_arvore: "",
      seccao: "",
      especie_id: "",
      especie_codigo: "",
      diametro1: "",
      diametro2: "",
      comprimento1: "",
      volume_florestal: "",
      diametro3: "",
      comprimento2: "",
      volume_comercial: "",
      is_dormente: false
    });
    setTempItems([]);
    setIsEditing(false);
    setItemsToDelete([]);
    setFeedback(null);
    setIsEditingItem(false); // Resetar estado de edição de item
    setEditingItemId(null); // Resetar ID do item em edição
    setItemEditLockError(null);
    setExistingItemsForCurrentEntrada([]); // Clear existing items for new form
  };

  const getExplorador = (id) => exploradores.find(explorador => explorador.id === id);
  const getRomaneador = (id) => romaneadores.find(romaneador => romaneador.id === id);
  const getEspecie = (id) => especies.find(especie => especie.id === id);

  const filteredEntradas = entradas.filter(entrada =>
    entrada.numero_registro.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getExplorador(entrada.explorador_id)?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getRomaneador(entrada.romaneador_id)?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateRomaneioPreview = () => {
    if (tempItems.length === 0) {
      setFeedback({type: "error", message: "Adicione pelo menos um item para visualizar o romaneio."});
      return;
    }

    // Criar uma nova janela para impressão
    const printWindow = window.open('', '_blank');

    // Agrupar itens por espécie para o layout do PDF
    const itensPorEspecie = {};
    tempItems.forEach(item => {
      const especieKey = item.especie_codigo || 'N/A';
      if (!itensPorEspecie[especieKey]) {
        itensPorEspecie[especieKey] = {
          codigo: item.especie_codigo,
          nome: item.especie_nome,
          itens: [],
          totalVolFlor: 0,
          totalVolCom: 0
        };
      }
      itensPorEspecie[especieKey].itens.push(item);
      itensPorEspecie[especieKey].totalVolFlor += parseFloat(item.volume_florestal || 0);
      itensPorEspecie[especieKey].totalVolCom += parseFloat(item.volume_comercial || 0);
    });

    // Formatar números para exibição (4 casas decimais com vírgula)
    const formatVolume = (num) => parseFloat(num).toLocaleString('pt-BR', {minimumFractionDigits: 4, maximumFractionDigits: 4}); // Ajustado para 4 casas decimais
    const formatMedida = (num) => parseFloat(num).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const explorador = exploradores.find(e => e.id === currentEntrada.explorador_id);
    const romaneador = romaneadores.find(r => r.id === currentEntrada.romaneador_id);

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Romaneio de Entrada ${currentEntrada.numero_registro}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.2;
          margin: 0;
          padding: 0;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        .company-info h1 {
          font-size: 18px;
          font-weight: bold;
          margin: 0;
          color: #2d5016;
        }
        .company-info p {
          margin: 2px 0;
          font-size: 10px;
        }
        .romaneio-info {
          text-align: right;
          font-size: 10px;
        }
        .romaneio-info p {
          margin: 2px 0;
        }
        .details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 15px;
          font-size: 10px;
        }
        .details p {
          margin: 3px 0;
        }
        .species-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .species-header {
          background-color: #f0f0f0;
          padding: 5px;
          font-weight: bold;
          border: 1px solid #ccc;
          margin-bottom: 5px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
          margin-bottom: 10px;
        }
        .items-table th,
        .items-table td {
          border: 1px solid #ccc;
          padding: 3px 5px;
          text-align: center;
        }
        .items-table th {
          background-color: #e8e8e8;
          font-weight: bold;
          font-size: 8px;
        }
        .items-table .text-left { text-align: left; }
        .items-table .text-right { text-align: right; }
        .species-total {
          background-color: #f9f9f9;
          font-weight: bold;
          border-top: 2px solid #333;
        }
        .grand-total {
          margin-top: 15px;
          padding: 10px;
          background-color: #e8f5e8;
          border: 2px solid #2d5016;
          text-align: center;
          font-weight: bold;
          font-size: 12px;
        }
        .dormente-mark {
          color: #dc2626;
          font-weight: bold;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>RGPW</h1>
          <p>Fazenda Esperança / Sistema de Controle Florestal</p>
        </div>
        <div class="romaneio-info">
          <p>${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
          <p><strong>Romaneio nº: ${currentEntrada.numero_registro}</strong></p>
          <p><strong>Data Romaneio: ${currentEntrada.data ? new Date(currentEntrada.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</strong></p>
        </div>
      </div>

      <div class="details">
        <div>
          <p><strong>Cliente/Origem:</strong> ${explorador?.nome || 'N/A'}</p>
          <p><strong>Motorista:</strong> ENTRADA - FAZ. ESPERANÇA</p>
        </div>
        <div>
          <p><strong>Romaneador:</strong> ${romaneador?.nome || 'N/A'}</p>
          ${currentEntrada.observacoes ? `<p><strong>Observações:</strong> ${currentEntrada.observacoes}</p>` : ''}
        </div>
      </div>

      ${Object.entries(itensPorEspecie).map(([especieKey, especieData]) => `
        <div class="species-section">
          <div class="species-header">
            ${especieData.codigo} - ${especieData.nome}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 8%">Número</th>
                <th style="width: 6%">Sec.</th>
                <th style="width: 8%">D_1</th>
                <th style="width: 8%">D_2</th>
                <th style="width: 8%">Comp.</th>
                <th style="width: 10%">Volume</th>
                <th style="width: 8%">Diâmetro</th>
                <th style="width: 8%">Comp.</th>
                <th style="width: 10%">Volume Com.</th>
                <th style="width: 8%">Obs.</th>
              </tr>
              <tr style="font-size: 7px; color: #666;">
                <th></th>
                <th></th>
                <th colspan="4">Cadeia de Custódia</th>
                <th colspan="3">Comercial</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${especieData.itens.map(item => `
                <tr>
                  <td>${item.numero_arvore}</td>
                  <td style="font-weight: bold; text-transform: uppercase;">${item.seccao}</td>
                  <td>${item.diametro1}</td>
                  <td>${item.diametro2}</td>
                  <td class="text-right">${formatMedida(item.comprimento1)}</td>
                  <td class="text-right">${formatVolume(item.volume_florestal)}</td>
                  <td>${item.diametro3 || item.diametro2}</td>
                  <td class="text-right">${formatMedida(item.comprimento2 || item.comprimento1)}</td>
                  <td class="text-right">${formatVolume(item.volume_comercial)}</td>
                  <td class="dormente-mark">${item.is_dormente ? 'DORMENTE' : ''}</td>
                </tr>
              `).join('')}
              <tr class="species-total">
                <td colspan="5" class="text-right"><strong>TOTAL ${especieData.codigo}:</strong></td>
                <td class="text-right"><strong>${formatVolume(especieData.totalVolFlor)}</strong></td>
                <td colspan="2"></td>
                <td class="text-right"><strong>${formatVolume(especieData.totalVolCom)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      `).join('')}

      <div class="grand-total">
        <p>TOTAL GERAL: ${formatVolume(currentEntrada.volume_florestal_total)} m³ (Florestal) | ${formatVolume(currentEntrada.volume_comercial_total)} m³ (Comercial)</p>
        <p>Quantidade de Árvores: ${tempItems.length} | Quantidade de Espécies: ${Object.keys(itensPorEspecie).length}</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const addLogToState = (message) => {
    // Esta função pode ser usada para atualizar um estado de logs se você quiser exibi-los na UI.
    // Por enquanto, vamos apenas logar no console.
    console.log(message);
  };

  // Helper function for number formatting (as per outline's implicit request)
  const formatarNumero = (num, decimalPlaces) => {
    if (num === null || num === undefined || isNaN(parseFloat(num))) {
        return '-';
    }
    const parsedNum = parseFloat(num);
    // If decimalPlaces is provided, format to that many fixed decimal places
    if (typeof decimalPlaces === 'number') {
        return parsedNum.toLocaleString('pt-BR', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        });
    }
    // Otherwise, use default toLocaleString for general number formatting
    return parsedNum.toLocaleString('pt-BR');
  };

  const renderEntradaDetails = (entradaId) => {
    const entrada = entradas.find(e => e.id === entradaId);
    if (!entrada) return <p>Entrada não encontrada.</p>;

    const itensDaEntrada = entradaItens.filter(item => item.entrada_id === entradaId);
    const explorador = exploradores.find(exp => exp.id === entrada.explorador_id);
    const romaneador = romaneadores.find(rom => rom.id === entrada.romaneador_id);

    // Calcular resumo por espécie
    const resumoPorEspecie = {};
    itensDaEntrada.forEach(item => {
      const especie = especies.find(esp => esp.id === item.especie_id);
      const especieNome = especie ? `${especie.codigo} - ${especie.nome}` : 'Desconhecida';
      if (!resumoPorEspecie[especieNome]) {
        resumoPorEspecie[especieNome] = {
          quantidade: 0,
          volume_florestal: 0,
          volume_comercial: 0
        };
      }
      resumoPorEspecie[especieNome].quantidade++;
      resumoPorEspecie[especieNome].volume_florestal += parseFloat(item.volume_florestal || 0);
      resumoPorEspecie[especieNome].volume_comercial += parseFloat(item.volume_comercial || 0);
    });

    const totalItens = itensDaEntrada.length;
    const totalVolumeFlorestalDetalhes = itensDaEntrada.reduce((sum, item) => sum + parseFloat(item.volume_florestal || 0), 0);
    const totalVolumeComercialDetalhes = itensDaEntrada.reduce((sum, item) => sum + parseFloat(item.volume_comercial || 0), 0);


    return (
      <Card className="mt-4 w-full">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl md:text-2xl">Detalhes do Romaneio de Entrada: {entrada.numero_registro}</CardTitle>
              <CardDescription>
                Data: {format(new Date(entrada.data + 'T00:00:00'), 'dd/MM/yyyy')} | 
                Explorador: {explorador?.nome || 'N/A'} | 
                Romaneador: {romaneador?.nome || 'N/A'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDetailsVisible(null)} className="ml-auto">
              <X className="h-4 w-4 mr-2" /> Fechar Detalhes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="itens" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="itens">Itens Lançados</TabsTrigger>
              <TabsTrigger value="resumo">Resumo por Espécie</TabsTrigger>
            </TabsList>
            <TabsContent value="itens">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Árv.</TableHead>
                      <TableHead>Seç.</TableHead>
                      <TableHead>Cód. Esp.</TableHead>
                      <TableHead>Espécie</TableHead>
                      <TableHead className="text-right">D1 (cm)</TableHead>
                      <TableHead className="text-right">D2 (cm)</TableHead>
                      <TableHead className="text-right">C1 (m)</TableHead>
                      <TableHead className="text-right">Vol. Flor. (m³)</TableHead>
                      <TableHead className="text-right">D3 (cm)</TableHead>
                      <TableHead className="text-right">C2 (m)</TableHead>
                      <TableHead className="text-right">Vol. Com. (m³)</TableHead>
                      <TableHead className="text-center">Dorm?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensDaEntrada.map(item => {
                      const especie = especies.find(esp => esp.id === item.especie_id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{item.numero_arvore}</TableCell>
                          <TableCell>{item.seccao}</TableCell>
                          <TableCell>{especie?.codigo || 'N/A'}</TableCell>
                          <TableCell>{especie?.nome || 'Desconhecida'}</TableCell>
                          <TableCell className="text-right">{formatarNumero(item.diametro1)}</TableCell>
                          <TableCell className="text-right">{formatarNumero(item.diametro2)}</TableCell>
                          <TableCell className="text-right">{formatarNumero(item.comprimento1, 2)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatarNumero(item.volume_florestal, 4)}</TableCell>
                          <TableCell className="text-right">{item.diametro3 ? formatarNumero(item.diametro3) : '-'}</TableCell>
                          <TableCell className="text-right">{item.comprimento2 ? formatarNumero(item.comprimento2, 2) : '-'}</TableCell>
                          <TableCell className="text-right font-semibold">{formatarNumero(item.volume_comercial, 4)}</TableCell>
                          <TableCell className="text-center">{item.is_dormente ? 'Sim' : 'Não'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={7} className="font-bold text-right">TOTAIS GERAIS:</TableCell>
                      <TableCell className="text-right font-bold">{formatarNumero(totalVolumeFlorestalDetalhes, 4)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-right font-bold">{formatarNumero(totalVolumeComercialDetalhes, 4)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              <p className="mt-2 text-sm text-gray-600">Total de Itens Lançados: {totalItens}</p>
            </TabsContent>
            <TabsContent value="resumo">
              <h4 className="text-md font-semibold mb-2">Resumo por Espécie</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Espécie</TableHead>
                    <TableHead className="text-center">Qtd. Peças</TableHead>
                    <TableHead className="text-right">Volume Comercial (m³)</TableHead>
                    <TableHead className="text-right">Volume Florestal (m³)</TableHead> 
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(resumoPorEspecie).map(([nomeEspecie, dados]) => (
                    <TableRow key={nomeEspecie}>
                      <TableCell>{nomeEspecie}</TableCell>
                      <TableCell className="text-center">{dados.quantidade}</TableCell>
                      <TableCell className="text-right font-medium">{formatarNumero(dados.volume_comercial, 4)}</TableCell>
                      <TableCell className="text-right font-medium">{formatarNumero(dados.volume_florestal, 4)}</TableCell> 
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-gray-100">
                        <TableCell className="font-bold">TOTAL GERAL</TableCell>
                        <TableCell className="text-center font-bold">
                            {Object.values(resumoPorEspecie).reduce((sum, esp) => sum + esp.quantidade, 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                            {formatarNumero(Object.values(resumoPorEspecie).reduce((sum, esp) => sum + esp.volume_comercial, 0), 4)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                            {formatarNumero(Object.values(resumoPorEspecie).reduce((sum, esp) => sum + esp.volume_florestal, 0), 4)}
                        </TableCell>
                    </TableRow>
                </TableFooter>
              </Table>
              <p className="mt-2 text-sm text-gray-600">
                Quantidade Total de Peças: {Object.values(resumoPorEspecie).reduce((sum, esp) => sum + esp.quantidade, 0)}
              </p>
            </TabsContent>
          </Tabs>
          {entrada.observacoes && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-md font-semibold">Observações:</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{entrada.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Função para renderizar feedback (sucesso, erro, aviso) no diálogo
  const renderFeedback = () => {
    if (!feedback) return null;
    return (
        <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'} className={`my-4 ${feedback.type === 'success' ? 'bg-green-50 border-green-300 text-green-700' : feedback.type === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}`}>
            {feedback.type === 'error' && <AlertCircle className="h-4 w-4" />}
            {feedback.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {feedback.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>{feedback.type === 'error' ? 'Erro' : feedback.type === 'success' ? 'Sucesso' : 'Aviso'}</AlertTitle>
            <AlertDescription>
              {feedback.message}
              {feedback.onConfirm && (
                <Button onClick={feedback.onConfirm} size="sm" className="mt-2 ml-auto">
                  Continuar Mesmo Assim
                </Button>
              )}
              {feedback.message.includes("Detalhes técnicos:") && <pre className="mt-2 text-xs whitespace-pre-wrap">{feedback.message.substring(feedback.message.indexOf("Detalhes técnicos:"))}</pre>}
            </AlertDescription>
        </Alert>
    );
  };


  if (loading && !isDialogOpen) { // Mostrar loading principal apenas se não for do diálogo
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-700" />
        <p className="ml-3 text-lg">Carregando dados das entradas...</p>
      </div>
    );
  }

  if (pageError) { // Mostrar erro da página se houver
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Erro ao Carregar Dados</AlertTitle>
          <AlertDescription>
            <p>{pageError}</p>
            <Button onClick={() => loadData(true)} className="mt-3">Tentar Novamente</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">Entrada de Madeira</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              resetForm();
              setIsEditing(false);
              setIsDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Entrada
          </Button>
        </div>
      </div>

      {feedback && feedback.type === "success" && ( // Page-level success feedback
        <Alert className="bg-green-50 border-green-200 text-green-700">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Sucesso</AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por número de romaneio ou responsáveis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        {loading ? ( // This loading is for the data fetch of the table
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-full max-h-[70vh] overflow-y-auto"> {/* Ajustar max-h conforme necessidade */}
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-32">Nº Romaneio</TableHead>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-40">Explorador</TableHead>
                    <TableHead className="w-40">Romaneador</TableHead>
                    <TableHead className="w-32 text-center">Vol. Flor. (m³)</TableHead>
                    <TableHead className="w-32 text-center">Vol. Com. (m³)</TableHead>
                    <TableHead className="w-32 text-center">Qtd. Árv.</TableHead>
                    <TableHead className="w-40 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntradas.length > 0 ? (
                    filteredEntradas.map((entrada) => {
                       // Contar itens para esta entrada específica
                       const qtdItensEntrada = entradaItens.filter(item => item.entrada_id === entrada.id).length;
                       return (
                      <React.Fragment key={entrada.id}>
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="font-medium">{entrada.numero_registro}</TableCell>
                          <TableCell className="text-sm">
                            {entrada.data ? format(new Date(entrada.data + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-sm">{getExplorador(entrada.explorador_id)?.nome || '-'}</TableCell>
                          <TableCell className="text-sm">{getRomaneador(entrada.romaneador_id)?.nome || '-'}</TableCell>
                          <TableCell className="text-center text-sm font-mono">
                            {parseFloat(entrada.volume_florestal_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:4, maximumFractionDigits:4})} {/* Ajustado para 4 casas decimais */}
                          </TableCell>
                          <TableCell className="text-center text-sm font-mono">
                            {parseFloat(entrada.volume_comercial_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:4, maximumFractionDigits:4})} {/* Ajustado para 4 casas decimais */}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {qtdItensEntrada}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(entrada)}
                                title="Ver detalhes"
                              >
                                <FileText className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => generatePDFForEntrada(entrada)}
                                title="Gerar PDF"
                              >
                                <Download className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(entrada)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4 text-amber-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(entrada.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {searchTerm
                          ? "Nenhuma entrada encontrada com os critérios de busca."
                          : "Nenhuma entrada cadastrada ainda."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {detailsVisible && renderEntradaDetails(detailsVisible)} {/* Render details view if detailsVisible state is set */}

      {/* Dialog para criar/editar entrada */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm(); // resetForm já limpa itemEditLockError indiretamente via setError(null) e outros resets
        setIsDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <LogIn className="h-5 w-5 mr-2 text-emerald-600" />
              {isEditing ? `Editar Romaneio ${currentEntrada.numero_registro}` : "Nova Entrada de Madeira"}
            </DialogTitle>
          </DialogHeader>

          {renderFeedback()} {/* Feedback geral do formulário/diálogo */}

          <form onSubmit={handleSubmit} id="dialog-form" className="space-y-4 overflow-y-auto flex-grow p-1">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="info">Informações do Romaneio</TabsTrigger>
                <TabsTrigger value="itens">Lançamento de Árvores</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="numero_registro">Número do Romaneio *</Label>
                    <Input
                      id="numero_registro"
                      name="numero_registro"
                      value={currentEntrada.numero_registro}
                      onChange={handleInputChange}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="data">Data *</Label>
                    <Input
                      id="data"
                      name="data"
                      type="date"
                      value={currentEntrada.data}
                      onChange={handleInputChange}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="explorador_id">Explorador *</Label>
                    <Select
                      value={currentEntrada.explorador_id}
                      onValueChange={(value) => handleSelectChange("explorador_id", value)}
                      required
                    >
                      <SelectTrigger id="explorador_id" className="mt-1">
                        <SelectValue placeholder="Selecione um explorador" />
                      </SelectTrigger>
                      <SelectContent>
                        {exploradores.map((explorador) => (
                          <SelectItem key={explorador.id} value={explorador.id}>
                            {explorador.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="romaneador_id">Romaneador *</Label>
                    <Select
                      value={currentEntrada.romaneador_id}
                      onValueChange={(value) => handleSelectChange("romaneador_id", value)}
                      required
                    >
                      <SelectTrigger id="romaneador_id" className="mt-1">
                        <SelectValue placeholder="Selecione um romaneador" />
                      </SelectTrigger>
                      <SelectContent>
                        {romaneadores.map((romaneador) => (
                          <SelectItem key={romaneador.id} value={romaneador.id}>
                            {romaneador.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    name="observacoes"
                    value={currentEntrada.observacoes}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1"
                  />
                </div>

                {/* Resumo de volumes */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Resumo de Volumes</CardTitle>
                    <CardDescription>Total de volumes por tipo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Volume Florestal Total:</p>
                        <p className="text-2xl font-bold text-emerald-700">
                          {parseFloat(currentEntrada.volume_florestal_total).toFixed(4)} m³ {/* Ajustado para 4 casas decimais */}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Volume Comercial Total:</p>
                        <p className="text-2xl font-bold text-emerald-700">
                          {parseFloat(currentEntrada.volume_comercial_total).toFixed(4)} m³ {/* Ajustado para 4 casas decimais */}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="itens" className="space-y-4 pt-4">
                {itemEditLockError && (
                    <Alert variant="destructive" className="my-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Edição Bloqueada</AlertTitle>
                        <AlertDescription>{itemEditLockError}</AlertDescription>
                    </Alert>
                )}

                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Lançamento de Árvores</h3>
                      <Button
                        type="button" // Importante para não submeter o form principal
                        onClick={() => setIsImportItensDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="border-blue-600 text-blue-700 hover:bg-blue-50"
                      >
                        <UploadCloud className="h-4 w-4 mr-2" />
                        Importar Itens CSV
                      </Button>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-end">
                      {/* Árvore */}
                      <div className="col-span-1">
                        <Label htmlFor="numero_arvore_input" className="text-xs">Árvore *</Label>
                        <Input
                          id="numero_arvore_input"
                          name="numero_arvore"
                          value={newItem.numero_arvore}
                          onChange={handleItemInputChange}
                          ref={numeroArvoreInputRef}
                          onKeyDown={(e) => handleKeyPress(e, especieCodigoInputRef)}
                          required
                          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Código Espécie */}
                      <div className="col-span-2">
                        <Label htmlFor="especie_codigo_input" className="text-xs">Cód. Espécie *</Label>
                        <Input
                          id="especie_codigo_input"
                          name="especie_codigo"
                          value={newItem.especie_codigo || ""}
                          placeholder="Ex: AN01"
                          onChange={handleItemInputChange}
                          onKeyDown={(e) => handleKeyPress(e, seccaoInputRef)}
                          onBlur={handleEspecieCodigoBlur}
                          ref={especieCodigoInputRef}
                          list="especies-list-entrada"
                          required
                          className="h-8 text-sm uppercase"
                        />
                        <datalist id="especies-list-entrada">
                          {especies.map(esp => (
                            <option key={esp.id} value={esp.codigo}>{esp.nome}</option>
                          ))}
                        </datalist>
                      </div>

                      {/* Secção */}
                      <div className="col-span-1">
                        <Label htmlFor="seccao_input" className="text-xs">Secção *</Label>
                        <Input
                          id="seccao_input"
                          name="seccao"
                          value={newItem.seccao}
                          onChange={handleItemInputChange}
                          ref={seccaoInputRef}
                          onKeyDown={(e) => handleKeyPress(e, diametro1InputRef)}
                          required
                          className="h-8 text-sm uppercase"
                          maxLength={1}
                        />
                      </div>

                      {/* Diâm.1 */}
                      <div className="col-span-1">
                        <Label htmlFor="diametro1_input" className="text-xs">Diâm.1*</Label>
                        <Input
                          id="diametro1_input"
                          name="diametro1"
                          type="text"
                          inputMode="decimal"
                          value={newItem.diametro1}
                          onChange={handleItemInputChange}
                          ref={diametro1InputRef}
                          onKeyDown={(e) => handleKeyPress(e, diametro2InputRef)}
                          required
                          className="h-8 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Diâm.2 */}
                      <div className="col-span-1">
                        <Label htmlFor="diametro2_input" className="text-xs">Diâm.2*</Label>
                        <Input
                          id="diametro2_input"
                          name="diametro2"
                          type="text"
                          inputMode="decimal"
                          value={newItem.diametro2}
                          onChange={handleItemInputChange}
                          ref={diametro2InputRef}
                          onKeyDown={(e) => handleKeyPress(e, comprimento1InputRef)}
                          required
                          className="h-8 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Comp.1 */}
                      <div className="col-span-1">
                        <Label htmlFor="comprimento1_input" className="text-xs">Comp.1*</Label>
                        <Input
                          id="comprimento1_input"
                          name="comprimento1"
                          type="text"
                          inputMode="decimal"
                          value={newItem.comprimento1}
                          onChange={handleItemInputChange}
                          ref={comprimento1InputRef}
                          onKeyDown={(e) => handleKeyPress(e, diametro3InputRef)}
                          required
                          className="h-8 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Diâm.3 */}
                      <div className="col-span-1">
                        <Label htmlFor="diametro3_input" className="text-xs">Diâm.3</Label>
                        <Input
                          id="diametro3_input"
                          name="diametro3"
                          type="text"
                          inputMode="decimal"
                          value={newItem.diametro3}
                          onChange={handleItemInputChange}
                          ref={diametro3InputRef}
                          onKeyDown={(e) => handleKeyPress(e, comprimento2InputRef)}
                          className="h-8 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Comp.2 */}
                      <div className="col-span-1">
                        <Label htmlFor="comprimento2_input" className="text-xs">Comp.2</Label>
                        <Input
                          id="comprimento2_input"
                          name="comprimento2"
                          type="text"
                          inputMode="decimal"
                          value={newItem.comprimento2}
                          onChange={handleItemInputChange}
                          ref={comprimento2InputRef}
                          onKeyDown={(e) => handleKeyPress(e, 'submit')}
                          className="h-8 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Vol. Flor. (Calculado) */}
                      <div className="col-span-1">
                        <Label className="text-xs">Vol. Flor.</Label>
                        <Input
                          value={parseFloat(newItem.volume_florestal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          readOnly
                          className="h-8 text-sm bg-gray-100 text-right"
                        />
                      </div>

                      {/* Vol. Com. (Calculado) */}
                      <div className="col-span-1">
                        <Label className="text-xs">Vol. Com.</Label>
                        <Input
                          value={parseFloat(newItem.volume_comercial || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          readOnly
                          className="h-8 text-sm bg-gray-100 text-right"
                        />
                      </div>

                    </div>

                    {/* Botão Add em linha separada */}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        className={`px-6 h-8 text-sm ${isEditingItem ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"}`}
                      >
                        {isEditingItem ? <Pencil className="h-3 w-3 mr-1"/> : <Plus className="h-3 w-3 mr-1"/>}
                        {isEditingItem ? "Atualizar" : "Add"}
                      </Button>
                    </div>

                    {/* Tabela de Itens Adicionados */}
                    <div className="max-h-[400px] overflow-y-auto border rounded-md">
                      <Table className="text-xs">
                        <TableHeader className="sticky top-0 bg-gray-100 z-10">
                          <TableRow>
                            <TableHead className="px-2 py-1 w-[5%] text-center">Dorm.</TableHead>
                            <TableHead className="px-2 py-1 w-[8%]">Árv.</TableHead>
                            <TableHead className="px-2 py-1 w-[15%]">Espécie</TableHead>
                            <TableHead className="px-2 py-1 w-[6%]">Sec.</TableHead>
                            <TableHead className="px-2 py-1 w-[8%] text-right">D1</TableHead>
                            <TableHead className="px-2 py-1 w-[8%] text-right">D2</TableHead>
                            <TableHead className="px-2 py-1 w-[8%] text-right">C1</TableHead>
                            <TableHead className="px-2 py-1 w-[8%] text-right">D3</TableHead>
                            <TableHead className="px-2 py-1 w-[8%] text-right">C2</TableHead>
                            <TableHead className="px-2 py-1 w-[10%] text-right">Vol.Flor.</TableHead>
                            <TableHead className="px-2 py-1 w-[10%] text-right">Vol.Com.</TableHead>
                            <TableHead className="px-2 py-1 w-[11%] text-center">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tempItems.map(item => {
                            const especie = getEspecie(item.especie_id);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="px-1 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedItems = tempItems.map(i =>
                                        i.id === item.id ? { ...i, is_dormente: !i.is_dormente } : i
                                      );
                                      setTempItems(updatedItems);
                                    }}
                                    className="p-1"
                                  >
                                    {item.is_dormente ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                                  </button>
                                </TableCell>
                                <TableCell className="px-2 py-1">{item.numero_arvore}</TableCell>
                                <TableCell className="px-2 py-1">
                                  <div className="text-xs">
                                    <div className="font-medium">{item.especie_codigo}</div>
                                    <div className="text-gray-500 truncate" title={item.especie_nome}>{item.especie_nome}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-2 py-1 uppercase font-medium">{item.seccao}</TableCell>
                                <TableCell className="px-2 py-1 text-right">{parseFloat(item.diametro1 || 0).toLocaleString('pt-BR')}</TableCell>
                                <TableCell className="px-2 py-1 text-right">{parseFloat(item.diametro2 || 0).toLocaleString('pt-BR')}</TableCell>
                                <TableCell className="px-2 py-1 text-right">{parseFloat(item.comprimento1 || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                <TableCell className="px-2 py-1 text-right">{item.diametro3 ? parseFloat(item.diametro3).toLocaleString('pt-BR') : '-'}</TableCell>
                                <TableCell className="px-2 py-1 text-right">{item.comprimento2 ? parseFloat(item.comprimento2).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</TableCell>
                                <TableCell className="px-2 py-1 text-right font-medium text-green-700">{parseFloat(item.volume_florestal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</TableCell>
                                <TableCell className="px-2 py-1 text-right font-medium text-blue-700">{parseFloat(item.volume_comercial || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</TableCell>
                                <TableCell className="px-1 py-1 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleEditItem(item.id)}
                                    title="Editar Item"
                                  >
                                    <Pencil className="h-3 w-3 text-amber-500" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleDeleteItem(item.id)}
                                    title="Excluir Item"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {tempItems.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                                Nenhuma árvore adicionada
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Resumo */}
                    <div className="flex justify-between items-center text-sm font-medium pt-2 border-t">
                      <p>Quantidade de Registros: {tempItems.length}</p>
                      <div className="flex gap-4">
                        <p>Volume Florestal: <span className="text-green-700">{parseFloat(currentEntrada.volume_florestal_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} m³</span></p>
                        <p>Volume Comercial: <span className="text-blue-700">{parseFloat(currentEntrada.volume_comercial_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} m³</span></p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRomaneioPreview}
                    className="border-blue-600 text-blue-700 hover:bg-blue-50"
                    disabled={tempItems.length === 0}
                    title="Visualizar e imprimir romaneio"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={loadingDialog}
                    form="dialog-form"
                  >
                    {loadingDialog ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {loadingDialog ? "Salvando..." : (isEditing ? "Atualizar Romaneio" : "Cadastrar Romaneio")}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Diálogo para importar itens CSV */}
      <ImportItensDialog
        isOpen={isImportItensDialogOpen}
        onClose={() => setIsImportItensDialogOpen(false)}
        onImportSuccess={handleImportItensSuccess}
        especiesList={especies} // Passa a lista de espécies carregadas
      />
    </div>
  );
}
