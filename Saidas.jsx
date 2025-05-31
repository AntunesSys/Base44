
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Saida } from "@/api/entities";
import { SaidaItem } from "@/api/entities";
import { EntradaItem } from "@/api/entities";
import { Explorador } from "@/api/entities";
import { Romaneador } from "@/api/entities";
import { Veiculo } from "@/api/entities";
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
  TableFooter,
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
  DialogDescription,
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
  X,
  FileText,
  Download,
  LogOut,
  AlertCircle,
  Check,
  AlertTriangle,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { DVPF } from "@/api/entities";
import { DVPFItem } from "@/api/entities";
import { Cliente } from "@/api/entities";
import { Notificacao } from "@/api/entities";

// Função para calcular Volume Florestal (baseado em D1, D2, C1)
const calcularVolumeFlorestalEspecifico = (diametro1_cm, diametro2_cm, comprimento_m) => {
  const d1 = parseFloat(diametro1_cm);
  const d2 = parseFloat(diametro2_cm);
  const c = parseFloat(comprimento_m);
  const CONSTANT = 0.00007854;

  if (isNaN(c) || c <= 0) return 0;
  let diametro_efetivo_cm;
  if (!isNaN(d1) && d1 > 0 && !isNaN(d2) && d2 > 0) diametro_efetivo_cm = (d1 + d2) / 2;
  else if (!isNaN(d1) && d1 > 0) diametro_efetivo_cm = d1;
  else if (!isNaN(d2) && d2 > 0) diametro_efetivo_cm = d2;
  else return 0;

  const volume = (diametro_efetivo_cm * diametro_efetivo_cm) * c * CONSTANT;
  return parseFloat(volume.toFixed(4));
};

// Função para calcular Volume Comercial (baseado em D3, C2)
const calcularVolumeComercialEspecifico = (diametro_cm, comprimento_m) => {
    const d = parseFloat(diametro_cm);
    const c = parseFloat(comprimento_m);
    const CONSTANT = 0.00007854;

    if (isNaN(d) || d <= 0 || isNaN(c) || c <= 0) {
        return 0;
    }
    const volume = (d * d) * c * CONSTANT;
    return parseFloat(volume.toFixed(4));
};

// Helper function to format numbers or return '-' if not a valid number
const formatarNumero = (value, decimalPlaces) => {
  const num = parseFloat(value);
  return isNaN(num) ? '-' : num.toFixed(decimalPlaces);
};


export default function SaidasPage() {
  // Estados principais
  const [saidas, setSaidas] = useState([]);
  const [saidaItens, setSaidaItens] = useState([]);
  const [entradaItens, setEntradaItens] = useState([]); // Keep this for display/fallback
  const [entradaItensMap, setEntradaItensMap] = useState(new Map()); // Mapa por numero_arvore_seccao
  const [entradaItensIdMap, setEntradaItensIdMap] = useState(new Map()); // NOVO: Mapa por ID
  const [exploradores, setExploradores] = useState([]);
  const [romaneadores, setRomaneadores] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [especies, setEspecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(null);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [tempItems, setTempItems] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [dvpfs, setDvpfs] = useState([]);
  const [dvpfItens, setDvpfItens] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [dvpfSaldos, setDvpfSaldos] = useState({});
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  // Estados para controle de carregamento
  const [dataLoadingStage, setDataLoadingStage] = useState("initial");
  const [retryCount, setRetryCount] = useState(0);

  const [currentSaida, setCurrentSaida] = useState({
    numero_registro: "",
    data: new Date().toISOString().split('T')[0],
    dvpf_id: null,
    explorador_id: "",
    romaneador_id: "",
    veiculo_id: "",
    volume_florestal_total: 0,
    volume_comercial_total: 0,
    observacoes: ""
  });

  const [currentItem, setCurrentItem] = useState({
    numero_arvore: "",
    seccao: "",
    entrada_item_id: "",
    d1_entrada: "",
    d2_entrada: "",
    c1_entrada: "",
    d3_entrada: "",
    c2_entrada: "",
    volume_florestal_entrada: 0,
    volume_comercial_entrada: 0,
    especie_id_entrada: "",
    is_dormente_entrada: false,
    d3_saida_editavel: "",
    c2_saida_editavel: "",
    volume_comercial_saida: 0,
  });

  const [especiesSummary, setEspeciesSummary] = useState({});

  const numeroArvoreRef = useRef(null);
  const seccaoRef = useRef(null);
  const adicionarItemRef = useRef(null);

  useEffect(() => {
    if (currentItem.entrada_item_id) {
        const novoVolumeComercial = calcularVolumeComercialEspecifico(
            currentItem.d3_saida_editavel,
            currentItem.c2_saida_editavel
        );
        setCurrentItem(prev => ({ ...prev, volume_comercial_saida: novoVolumeComercial }));
    } else {
        setCurrentItem(prev => ({ ...prev, volume_comercial_saida: 0 }));
    }
  }, [currentItem.d3_saida_editavel, currentItem.c2_saida_editavel, currentItem.entrada_item_id]);

  useEffect(() => {
    loadData();
    const handleBeforeUnload = (event) => {
      if (isDialogOpen && (currentSaida.numero_registro || tempItems.length > 0)) {
        event.preventDefault();
        event.returnValue = '';
        return 'Você tem alterações não salvas. Tem certeza que deseja sair?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDialogOpen, currentSaida.numero_registro, tempItems.length]);

  // Função para retry com backoff exponencial mais agressivo
  const retryWithDelay = async (fn, retries = 5, delay = 2000) => {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && (error.response?.status === 429 || error.message?.includes('429') || error.message?.includes('Rate limit'))) {
        console.log(`Rate limit hit, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithDelay(fn, retries - 1, delay * 2); // Exponential backoff mais agressivo
      }
      throw error;
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setDataLoadingStage("basic");

    try {
      // Fase 1: Carregar apenas dados essenciais para exibir a lista básica
      console.log("Carregando dados básicos...");
      const [saidasData, exploradoresData, romaneadoresData, veiculosData, especiesData] = await Promise.all([
        retryWithDelay(() => Saida.list('-created_date')),
        retryWithDelay(() => Explorador.list()),
        retryWithDelay(() => Romaneador.list()),
        retryWithDelay(() => Veiculo.list()),
        retryWithDelay(() => Especie.list())
      ]);

      setSaidas(saidasData);
      setExploradores(exploradoresData);
      setRomaneadores(romaneadoresData);
      setVeiculos(veiculosData);
      setEspecies(especiesData);

      setDataLoadingStage("secondary");

      // Mostrar interface básica já funcional
      setLoading(false);

      // Fase 2: Carregar dados secundários com delay maior
      console.log("Carregando dados secundários...");
      setTimeout(async () => {
        try {
          const clientesData = await retryWithDelay(() => Cliente.list());
          setClientes(clientesData);

          // Esperar mais antes de carregar dados pesados
          setTimeout(async () => {
            try {
              setDataLoadingStage("heavy");
              console.log("Carregando dados pesados...");

              const [loadedEntradaItens, dvpfsData] = await Promise.all([
                retryWithDelay(() => EntradaItem.list()),
                retryWithDelay(() => DVPF.list())
              ]);

              setEntradaItens(loadedEntradaItens); // Keep this for display/fallback
              const newMap = new Map();
              const newIdMap = new Map(); // Mapa por ID
              loadedEntradaItens.forEach(item => {
                const key = `${item.numero_arvore.toString()}_${item.seccao.toUpperCase()}`;
                newMap.set(key, item);
                newIdMap.set(item.id, item); // Popular mapa por ID
              });
              setEntradaItensMap(newMap);
              setEntradaItensIdMap(newIdMap); // Salvar mapa por ID

              setDvpfs(dvpfsData);

              // Fase 3: Carregar dados de relacionamento com delay ainda maior
              setTimeout(async () => {
                try {
                  setDataLoadingStage("final");
                  console.log("Carregando dados finais...");

                  const [saidaItensAllData, dvpfItensData] = await Promise.all([
                    retryWithDelay(() => SaidaItem.list()),
                    dvpfsData.length > 0 ? retryWithDelay(() => DVPFItem.list()) : Promise.resolve([])
                  ]);

                  setSaidaItens(saidaItensAllData);
                  if (dvpfsData.length > 0) {
                    setDvpfItens(dvpfItensData);
                    // Usar saidasData que já está carregado do passo inicial
                    calcularSaldosDVPF(dvpfsData, dvpfItensData, saidasData, saidaItensAllData);
                  }

                  setDataLoadingStage("complete");
                  console.log("Carregamento completo!");

                } catch (finalError) {
                  console.error("Erro ao carregar dados finais:", finalError);
                  setError("Algumas funcionalidades avançadas podem estar limitadas devido a problemas de conectividade.");
                  setDataLoadingStage("error_final");
                }
              }, 1500); // 1.5 segundos entre fases pesadas

            } catch (heavyError) {
              console.error("Erro ao carregar dados pesados:", heavyError);
              setError("Algumas funcionalidades podem estar limitadas. Tente recarregar a página em alguns momentos.");
              setDataLoadingStage("error_heavy");
            }
          }, 1000); // 1 segundo antes dos dados pesados

        } catch (secondaryError) {
          console.error("Erro ao carregar dados secundários:", secondaryError);
          setError("Algumas funcionalidades podem estar limitadas.");
          setDataLoadingStage("error_secondary");
        }
      }, 500); // 0.5 segundo antes dos dados secundários

    } catch (error) {
      console.error("Erro ao carregar dados principais:", error);
      setLoading(false);
      let errorMsg = "Erro ao carregar dados. Por favor, tente novamente.";
      if (error.response?.status === 429 || error.message?.includes('429') || error.message?.includes('Rate limit')) {
        errorMsg = "Sistema temporariamente ocupado. Aguarde alguns instantes e recarregue a página.";
        setRetryCount(prev => prev + 1);
      }
      setError(errorMsg);
      setDataLoadingStage("error_basic");
    }
  };

  const handleRetryLoad = () => {
    setRetryCount(0);
    loadData();
  };

  const calcularSaldosDVPF = (dvpfs, dvpfItens, saidas, saidaItens) => {
    const saldos = {};
    dvpfs.forEach(dvpf => {
      saldos[dvpf.id] = { cliente_id: dvpf.cliente_id, numero: dvpf.numero, especies: {} };
      const itensDvpf = dvpfItens.filter(item => item.dvpf_id === dvpf.id);
      itensDvpf.forEach(item => {
        if (!saldos[dvpf.id].especies[item.especie_id]) {
          saldos[dvpf.id].especies[item.especie_id] = { volume_total: 0, volume_usado: 0, saldo: 0 };
        }
        saldos[dvpf.id].especies[item.especie_id].volume_total += parseFloat(item.volume || 0);
      });
    });
    saidas.forEach(saida => {
      if (!saida.dvpf_id) return;
      const itensSaida = saidaItens.filter(item => item.saida_id === saida.id);
      itensSaida.forEach(item => {
        if (saldos[saida.dvpf_id] && saldos[saida.dvpf_id].especies[item.especie_id]) {
          saldos[saida.dvpf_id].especies[item.especie_id].volume_usado += parseFloat(item.volume_comercial || 0);
        }
      });
    });
    Object.keys(saldos).forEach(dvpfId => {
      Object.keys(saldos[dvpfId].especies).forEach(especieId => {
        const especie = saldos[dvpfId].especies[especieId];
        especie.saldo = especie.volume_total - especie.volume_usado;
      });
    });
    setDvpfSaldos(saldos);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentSaida(prev => ({ ...prev, [name]: value }));
  };

  const handleVeiculoSelect = (veiculoId) => {
    setCurrentSaida(prev => ({ ...prev, veiculo_id: veiculoId }));
  };

  const handleItemInputChange = async (e) => {
    const { name, value } = e.target;
    if (name === "numero_arvore") {
      const onlyNumbers = value.replace(/\D/g, '');
      setCurrentItem(prev => ({ ...prev, [name]: onlyNumbers }));
      if (!onlyNumbers || !currentItem.seccao) clearEntradaItemData();
    } else if (name === "seccao") {
      const onlyLetters = value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      setCurrentItem(prev => ({ ...prev, [name]: onlyLetters }));
      if (!currentItem.numero_arvore || !onlyLetters) clearEntradaItemData();
    } else if (name === "d3_saida_editavel" || name === "c2_saida_editavel") {
      setCurrentItem(prev => ({ ...prev, [name]: value }));
    }
    const finalNumeroArvore = name === "numero_arvore" ? value.replace(/\D/g, '') : currentItem.numero_arvore;
    const finalSeccao = name === "seccao" ? value.replace(/[^a-zA-Z]/g, '').toUpperCase() : currentItem.seccao;
    if (!finalNumeroArvore || !finalSeccao) {
        if (name === "numero_arvore" && !value) clearEntradaItemData();
        if (name === "seccao" && !value) clearEntradaItemData();
    }
  };

  const clearEntradaItemData = () => {
    setCurrentItem(prev => ({
        ...prev,
        entrada_item_id: "", d1_entrada: "", d2_entrada: "", c1_entrada: "",
        d3_entrada: "", c2_entrada: "", volume_florestal_entrada: 0,
        volume_comercial_entrada: 0, especie_id_entrada: "", is_dormente_entrada: false,
        d3_saida_editavel: "", c2_saida_editavel: "", volume_comercial_saida: 0,
    }));
    setError(null);
  };

  const handleKeyPress = (e, nextField) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextField && nextField.current) {
        nextField.current.focus();
      }
    }
  };

  const buscarDadosEntrada = async (numeroArvore, seccao) => {
    if (dataLoadingStage !== "complete") {
      setFeedback({ type: 'error', message: "Aguarde o carregamento completo dos dados para buscar árvores." });
      return;
    }

    if (!numeroArvore || !seccao) {
        clearEntradaItemData();
        setFeedback({ type: 'error', message: "Número da árvore e seção são obrigatórios para busca."});
        return;
    }
    // Use the map for O(1) lookup
    const key = `${numeroArvore.toString()}_${seccao.toUpperCase()}`;
    const itemEntrada = entradaItensMap.get(key);

    if (itemEntrada) {
      setCurrentItem(prev => ({
        ...prev,
        entrada_item_id: itemEntrada.id,
        d1_entrada: itemEntrada.diametro1 || "", d2_entrada: itemEntrada.diametro2 || "",
        c1_entrada: itemEntrada.comprimento1 || "", d3_entrada: itemEntrada.diametro3 || "",
        c2_entrada: itemEntrada.comprimento2 || "",
        volume_florestal_entrada: parseFloat(itemEntrada.volume_florestal || 0),
        volume_comercial_entrada: parseFloat(itemEntrada.volume_comercial || 0),
        especie_id_entrada: itemEntrada.especie_id,
        is_dormente_entrada: itemEntrada.is_dormente || false,
        d3_saida_editavel: itemEntrada.diametro3 || "",
        c2_saida_editavel: itemEntrada.comprimento2 || "",
      }));
      setFeedback(null);
    } else {
      clearEntradaItemData();
      setCurrentItem(prev => ({...prev, numero_arvore: numeroArvore, seccao: seccao}));
      setFeedback({ type: 'error', message: "Árvore não encontrada nas entradas." });
    }
  };

  const verificarDuplicidadeEReuso = (itemSendoAdicionado) => {
    // Verificação 1: Duplicidade no romaneio atual (tempItems)
    // Não permite adicionar o MESMO item de entrada (identificado por entrada_item_id) mais de uma vez no mesmo romaneio.
    if (!isEditingItem) { // Só checa duplicidade se não estiver editando um item já na lista tempItems
      const duplicadoTemp = tempItems.find(
        item => item.entrada_item_id === itemSendoAdicionado.entrada_item_id
      );
      if (duplicadoTemp) {
        return {
          bloquear: true,
          mensagem: `Item Árvore ${itemSendoAdicionado.numero_arvore} - Seção ${itemSendoAdicionado.seccao} já foi adicionado a este romaneio.`,
          tipo: "aviso_duplicidade_temp"
        };
      }
    }

    // Verificação 2: Item já transportado em outro romaneio salvo
    // Procura por qualquer SaidaItem no banco que tenha o mesmo entrada_item_id
    const itemJaTransportado = saidaItens.find(
      dbItem => dbItem.entrada_item_id === itemSendoAdicionado.entrada_item_id &&
                (!isEditing || dbItem.saida_id !== currentSaida.id) // Se estiver editando, ignora itens do próprio romaneio atual
    );

    if (itemJaTransportado) {
      const saidaRelacionada = saidas.find(s => s.id === itemJaTransportado.saida_id);
      return {
        bloquear: true,
        mensagem: `Item Árvore ${itemSendoAdicionado.numero_arvore} - Seção ${itemSendoAdicionado.seccao} já foi transportado no Romaneio ${saidaRelacionada?.numero_registro || "Desconhecido"}.`,
        saidaRelacionada: saidaRelacionada,
        tipo: "aviso_ja_transportado"
      };
    }
    return { bloquear: false };
  };

  const resetCurrentItemState = () => {
    setCurrentItem({
      numero_arvore: "",
      seccao: "",
      entrada_item_id: "",
      d1_entrada: "",
      d2_entrada: "",
      c1_entrada: "",
      d3_entrada: "",
      c2_entrada: "",
      volume_florestal_entrada: 0,
      volume_comercial_entrada: 0,
      especie_id_entrada: "",
      is_dormente_entrada: false,
      d3_saida_editavel: "",
      c2_saida_editavel: "",
      volume_comercial_saida: 0,
    });
    // setFeedback(null);
    setDuplicateWarning(null);
  };

  const handleAddItem = () => {
    setFeedback(null); // Limpar feedback anterior
    setDuplicateWarning(null);

    if (!currentItem.numero_arvore || !currentItem.seccao || !currentItem.entrada_item_id) {
      setFeedback({ type: 'error', message: "Preencha Árvore/Seção e busque um item válido da entrada antes de adicionar." });
      return;
    }
    const d3val = parseFloat(currentItem.d3_saida_editavel);
    const c2val = parseFloat(currentItem.c2_saida_editavel);

    if ((currentItem.d3_saida_editavel && (isNaN(d3val) || d3val <= 0)) || (currentItem.c2_saida_editavel && (isNaN(c2val) || c2val <= 0))) {
        setFeedback({ type: 'error', message: "Se D3 ou C2 Saída forem preenchidos, devem ser números válidos maiores que zero."});
        return;
    }
     if ((currentItem.d3_saida_editavel && !currentItem.c2_saida_editavel) || (!currentItem.d3_saida_editavel && currentItem.c2_saida_editavel)) {
        setFeedback({ type: 'error', message: "Se D3 ou C2 Saída for preenchido, o par correspondente também deve ser."});
        return;
    }

    const especieObj = especies.find(esp => esp.id === currentItem.especie_id_entrada);
    const newItemData = {
      // Usar o ID do item que está sendo editado, ou um ID temporário novo
      id: isEditingItem && editingItemId ? editingItemId : `temp_${Date.now().toString()}`,
      numero_arvore: currentItem.numero_arvore,
      seccao: currentItem.seccao.toUpperCase(), // Garantir que seção seja maiúscula
      entrada_item_id: currentItem.entrada_item_id, // ID do item de entrada original
      especie_id: currentItem.especie_id_entrada,
      especie_nome: especieObj ? `${especieObj.codigo || ''} - ${especieObj.nome}` : "Desconhecido",
      
      d1_entrada: currentItem.d1_entrada,
      d2_entrada: currentItem.d2_entrada,
      c1_entrada: currentItem.c1_entrada,
      d3_entrada_original: currentItem.d3_entrada, 
      c2_entrada_original: currentItem.c2_entrada, 
      volume_comercial_entrada_original: currentItem.volume_comercial_entrada,
      
      d3_saida: currentItem.d3_saida_editavel, 
      c2_saida: currentItem.c2_saida_editavel, 
      is_dormente: currentItem.is_dormente_entrada,
      volume_florestal: currentItem.volume_florestal_entrada, // Volume florestal original da entrada
      volume_comercial: currentItem.volume_comercial_saida, // Volume comercial calculado para a saída
    };

    // VALIDAÇÃO DE DUPLICIDADE E REUSO
    const validacao = verificarDuplicidadeEReuso(newItemData);
    if (validacao.bloquear) {
        if (validacao.tipo === "aviso_ja_transportado") {
            setDuplicateWarning({ // Usar duplicateWarning para este tipo de aviso
                duplicado: true,
                item: {}, // Pode não precisar do item aqui
                saidaRelacionada: validacao.saidaRelacionada,
                mensagem: validacao.mensagem
            });
        } else {
             setFeedback({ type: 'error', message: validacao.mensagem });
        }
        return;
    }

    let updatedItems;
    if (isEditingItem) {
      updatedItems = tempItems.map(item => item.id === editingItemId ? newItemData : item);
      setTempItems(updatedItems);
      setIsEditingItem(false);
      setEditingItemId(null);
      setFeedback({type: 'success', message: 'Item atualizado no romaneio.'});
    } else {
      updatedItems = [newItemData, ...tempItems]; // Adiciona no início para visualização mais fácil
      setTempItems(updatedItems);
      setFeedback({type: 'success', message: 'Item adicionado ao romaneio.'});
    }

    recalcularTotais(updatedItems);
    calcularResumoEspecies(updatedItems);
    resetCurrentItemState(); // Limpa campos para novo lançamento
    if (numeroArvoreRef.current) {
      numeroArvoreRef.current.focus();
    }
  };

  const handleDeleteTempItem = useCallback((tempId) => {
    console.log("Tentando excluir item com ID:", tempId); // Para debug
    setTempItems(prev => {
      const itemToDelete = prev.find(item => item.id === tempId);
      console.log("Item encontrado para exclusão:", itemToDelete); // Para debug
      
      const newItems = prev.filter(item => item.id !== tempId);
      console.log("Lista após exclusão:", newItems.length, "itens restantes"); // Para debug
      
      recalcularTotais(newItems);
      calcularResumoEspecies(newItems);
      
      // Se o item excluído era o que estava sendo editado, limpar o formulário
      if (editingItemId === tempId) {
          resetCurrentItemState();
          setIsEditingItem(false);
          setEditingItemId(null);
          console.log("Item em edição foi excluído, limpando formulário"); // Para debug
      }
      return newItems;
    });
    
    // Mostrar feedback de sucesso
    setFeedback({type: 'success', message: 'Item removido do romaneio.'});
  }, [editingItemId]); // Dependency on editingItemId

  const recalcularTotais = (items) => {
    let volumeFlorestalTotal = 0;
    let volumeComercialTotal = 0;
    items.forEach(item => {
      volumeFlorestalTotal += parseFloat(item.volume_florestal || 0);
      volumeComercialTotal += parseFloat(item.volume_comercial || 0);
    });
    setCurrentSaida(prev => ({
      ...prev,
      volume_florestal_total: parseFloat(volumeFlorestalTotal.toFixed(4)),
      volume_comercial_total: parseFloat(volumeComercialTotal.toFixed(4))
    }));
  };

  const calcularResumoEspecies = (items) => {
    const resumo = {};
    items.forEach(item => {
      if (!resumo[item.especie_id]) {
        resumo[item.especie_id] = { volume_florestal: 0, volume_comercial: 0, quantidade: 0 };
      }
      resumo[item.especie_id].volume_florestal += parseFloat(item.volume_florestal || 0);
      resumo[item.especie_id].volume_comercial += parseFloat(item.volume_comercial || 0);
      resumo[item.especie_id].quantidade += 1;
    });
    setEspeciesSummary(resumo);
  };

  const handleSaveSaida = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    
    console.log("Salvando romaneio com", tempItems.length, "itens"); // Para debug
    console.log("Itens a serem salvos:", tempItems.map(item => ({id: item.id, numero_arvore: item.numero_arvore, seccao: item.seccao}))); // Para debug
    
    if (!currentSaida.numero_registro || !currentSaida.data ||
        !currentSaida.explorador_id || !currentSaida.romaneador_id || !currentSaida.veiculo_id) {
      setFeedback({ type: 'error', message: "Preencha todos os campos obrigatórios da saída." });
      setLoading(false); 
      return;
    }
    
    if (tempItems.length === 0) {
      setFeedback({ type: 'error', message: "Adicione pelo menos um item na saída." });
      setLoading(false); 
      return;
    }
    
    try {
      let saidaOperacao;
      let saidaId;
      
      const saidaDataToSave = {
        ...currentSaida,
        volume_florestal_total: parseFloat(currentSaida.volume_florestal_total || 0),
        volume_comercial_total: parseFloat(currentSaida.volume_comercial_total || 0),
      };
      
      if (isEditing) {
        const { id, ...dataForUpdate } = saidaDataToSave;
        saidaOperacao = retryWithDelay(() => Saida.update(id, dataForUpdate));
        saidaId = id;
        console.log("Atualizando saída existente ID:", saidaId); // Para debug
      } else {
        saidaOperacao = retryWithDelay(() => Saida.create(saidaDataToSave));
        console.log("Criando nova saída"); // Para debug
      }
      
      const saidaResult = await saidaOperacao;
      if (!isEditing) saidaId = saidaResult.id;

      // SINCRONIZAÇÃO MAIS ROBUSTA DOS ITENS
      const existingSaidaItemsForThisSaida = saidaItens.filter(si => si.saida_id === saidaId);
      console.log("Itens existentes no banco para esta saída:", existingSaidaItemsForThisSaida.length); // Para debug
      
      // Itens que devem existir (baseado na lista tempItems atual)
      const itemsToProcess = tempItems.map(item => ({
        saida_id: saidaId,
        entrada_item_id: item.entrada_item_id,
        numero_arvore: parseInt(item.numero_arvore),
        seccao: item.seccao,
        especie_id: item.especie_id,
        volume_florestal: parseFloat(item.volume_florestal || 0),
        volume_comercial: parseFloat(item.volume_comercial || 0),
      }));
      
      console.log("Itens que devem existir após salvamento:", itemsToProcess.length); // Para debug
      
      // IDs dos entrada_item_id que DEVEM estar presentes
      const currentTempEntradaItemIds = new Set(itemsToProcess.map(its => its.entrada_item_id));
      
      // PASSO 1: Excluir itens que existem no banco mas NÃO estão na lista tempItems atual
      for (const existingItemInDb of existingSaidaItemsForThisSaida) {
        if (!currentTempEntradaItemIds.has(existingItemInDb.entrada_item_id)) {
            console.log("Excluindo item do banco:", existingItemInDb.numero_arvore, existingItemInDb.seccao); // Para debug
            await retryWithDelay(() => SaidaItem.delete(existingItemInDb.id));
            await new Promise(resolve => setTimeout(resolve, 200)); // Delay para evitar rate limit
        }
      }
      
      // PASSO 2: Criar ou atualizar itens que estão na lista tempItems
      for (const item of itemsToProcess) {
          const existing = existingSaidaItemsForThisSaida.find(si => si.entrada_item_id === item.entrada_item_id);
          
          if (existing) {
              // Item já existe - verificar se precisa atualizar
              const hasChanged = 
                  existing.numero_arvore !== item.numero_arvore ||
                  existing.seccao !== item.seccao || 
                  existing.especie_id !== item.especie_id ||
                  Math.abs(existing.volume_florestal - item.volume_florestal) > 0.000001 ||
                  Math.abs(existing.volume_comercial - item.volume_comercial) > 0.000001;
                  
              if (hasChanged) {
                  console.log("Atualizando item existente:", item.numero_arvore, item.seccao); // Para debug
                  await retryWithDelay(() => SaidaItem.update(existing.id, item));
              } else {
                  console.log("Item inalterado:", item.numero_arvore, item.seccao); // Para debug
              }
          } else {
              // Item novo - criar
              console.log("Criando novo item:", item.numero_arvore, item.seccao); // Para debug
              await retryWithDelay(() => SaidaItem.create(item));
          }
          await new Promise(resolve => setTimeout(resolve, 200)); // Delay para evitar rate limit
      }

      // Tentar criar notificação (opcional)
      try {
        let clienteNome = "Cliente não informado";
        if (currentSaida.dvpf_id) {
          const dvpf = dvpfs.find(d => d.id === currentSaida.dvpf_id);
          if (dvpf) {
            const cliente = clientes.find(c => c.id === dvpf.cliente_id);
            clienteNome = cliente ? cliente.nome : "Cliente não encontrado";
          }
        }
        
        const veiculo = veiculos.find(v => v.id === currentSaida.veiculo_id);
        const veiculoInfo = veiculo ? `${veiculo.placa_cavalo}${veiculo.nome_motorista ? ` (${veiculo.nome_motorista})` : ''}` : "Veículo não encontrado";
        
        await retryWithDelay(() => Notificacao.create({
          titulo: isEditing ? "Saída Atualizada" : "Nova Saída Cadastrada",
          mensagem: isEditing
            ? `Romaneio de saída ${currentSaida.numero_registro} para ${clienteNome} foi atualizado com ${tempItems.length} árvores (${parseFloat(currentSaida.volume_comercial_total).toFixed(4)}m³) no veículo ${veiculoInfo}.`
            : `Novo romaneio de saída ${currentSaida.numero_registro} para ${clienteNome} foi cadastrado com ${tempItems.length} árvores (${parseFloat(currentSaida.volume_comercial_total).toFixed(4)}m³) no veículo ${veiculoInfo}.`,
          data: new Date().toISOString(),
          tipo: "informacao",
          lida: false
        }));
      } catch (notifError) {
        console.error("Erro ao criar notificação (não crítico):", notifError);
      }

      setFeedback({ type: 'success', message: isEditing ? "Saída atualizada com sucesso!" : "Saída cadastrada com sucesso!" });
      
      // Aguardar um pouco mais antes de fechar e recarregar
      setTimeout(() => {
          setIsDialogOpen(false);
          resetForm();
          loadData(); // Recarregar todos os dados
      }, 2000); // Aumentado de 1500 para 2000ms
      
    } catch (error) {
      console.error("Erro ao salvar saída:", error);
      let errorMessage = `Erro ao salvar saída: ${error.message || "Por favor, tente novamente."}`;
      if (error.response?.status === 429 || error.message?.includes('429') || error.message?.includes('Rate limit')) {
        errorMessage = "Sistema temporariamente ocupado. Aguarde um momento e tente novamente.";
      }
      setFeedback({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (saidaId) => {
    if (detailsVisible === saidaId) {
      setDetailsVisible(null); return;
    }
    setDetailsVisible(saidaId);
  };

  const handleEditTempItem = useCallback((itemId) => {
    const itemToEdit = tempItems.find(item => item.id === itemId);
    if (itemToEdit) {
      // Usar o entradaItensIdMap para buscar o item original da entrada
      const entradaItemOriginal = entradaItensIdMap.get(itemToEdit.entrada_item_id);

      setCurrentItem({
        numero_arvore: itemToEdit.numero_arvore,
        seccao: itemToEdit.seccao,
        entrada_item_id: itemToEdit.entrada_item_id,
        d1_entrada: entradaItemOriginal?.diametro1 || "",
        d2_entrada: entradaItemOriginal?.diametro2 || "",
        c1_entrada: entradaItemOriginal?.comprimento1 || "",
        d3_entrada: entradaItemOriginal?.diametro3 || "", // Original D3 from entrada
        c2_entrada: entradaItemOriginal?.comprimento2 || "", // Original C2 from entrada
        volume_florestal_entrada: parseFloat(entradaItemOriginal?.volume_florestal || 0), // Volume florestal do item de entrada
        volume_comercial_entrada: parseFloat(entradaItemOriginal?.volume_comercial || 0), // Vol comercial original da entrada
        especie_id_entrada: entradaItemOriginal?.especie_id || "",
        is_dormente_entrada: entradaItemOriginal?.is_dormente || false,
        d3_saida_editavel: itemToEdit.d3_saida || "", // D3 que foi usado para esta saída (pode ser diferente do original se editado)
        c2_saida_editavel: itemToEdit.c2_saida || "", // C2 que foi usado para esta saída (pode ser diferente do original se editado)
        volume_comercial_saida: parseFloat(itemToEdit.volume_comercial || 0), // Este é o volume comercial calculado para a saída
       });
      setIsEditingItem(true);
      setEditingItemId(itemId);
      if (numeroArvoreRef.current) numeroArvoreRef.current.focus();
    }
  }, [tempItems, entradaItensIdMap]); // Dependencies for useCallback

  const handleEdit = async (saida) => {
    if (dataLoadingStage !== "complete") {
      setError("Aguarde o carregamento completo dos dados para editar romaneios.");
      return;
    }

    setCurrentSaida(saida);
    setIsEditing(true);
    setFeedback(null);
    const itensDaSaidaGravados = saidaItens.filter(item => item.saida_id === saida.id);

    const tempItemsFormatados = await Promise.all(
      itensDaSaidaGravados.map(async (itemSaida) => {
        const especieObj = especies.find(esp => esp.id === itemSaida.especie_id);
        // Usar o mapa por ID para buscar o EntradaItem original
        const entradaItemOriginal = entradaItensIdMap.get(itemSaida.entrada_item_id);

        return {
          id: itemSaida.id, // ID do SaidaItem
          entrada_item_id: itemSaida.entrada_item_id,
          numero_arvore: itemSaida.numero_arvore,
          seccao: itemSaida.seccao,
          especie_id: itemSaida.especie_id,
          especie_nome: especieObj ? `${especieObj.codigo || ''} - ${especieObj.nome}` : "Desconhecido",

          d1_entrada: entradaItemOriginal?.diametro1 || "",
          d2_entrada: entradaItemOriginal?.diametro2 || "",
          c1_entrada: entradaItemOriginal?.comprimento1 || "",
          d3_entrada_original: entradaItemOriginal?.diametro3 || "", // Original D3 from entrada
          c2_entrada_original: entradaItemOriginal?.comprimento2 || "", // Original C2 from entrada
          volume_comercial_entrada_original: entradaItemOriginal?.volume_comercial || 0, // Vol comercial da entrada

          // D3 e C2 que foram efetivamente usados para esta SaidaItem
          // A SaidaItem não guarda d3/c2 editáveis. O volume comercial é salvo,
          // mas os D3/C2 são do item de ENTRADA.
          // Para permitir a edição na saída, estamos usando `d3_saida_editavel` e `c2_saida_editavel`.
          // Estes campos são inicializados com os valores da entrada, mas podem ser alterados.
          // O `tempItems` deve armazenar os valores que foram usados para calcular o volume comercial
          // que está salvo no `itemSaida.volume_comercial`.
          // Se o SaidaItem não guarda os d3_saida/c2_saida explicitamente,
          // precisamos assumir que eles são os mesmos da entrada (diametro3 e comprimento2)
          // a menos que haja uma lógica para derivá-los do volume_comercial.
          // Por simplicidade e seguindo a estrutura do `currentItem`, usaremos os da entrada.
          d3_saida: entradaItemOriginal?.diametro3 || "", // D3 usado para este SaidaItem (pode ser o da entrada)
          c2_saida: entradaItemOriginal?.comprimento2 || "", // C2 usado para este SaidaItem (pode ser o da entrada)

          volume_florestal: parseFloat(itemSaida.volume_florestal || 0),
          volume_comercial: parseFloat(itemSaida.volume_comercial || 0),
          is_dormente: entradaItemOriginal?.is_dormente || false,
        };
      })
    );

    if (saida.dvpf_id && saida.dvpf_id !== NO_DVPF_VALUE) {
      const dvpf = dvpfs.find(d => d.id === saida.dvpf_id);
      if (dvpf) {
        const cliente = clientes.find(c => c.id === dvpf.cliente_id);
        setSelectedCliente(cliente || null);
      } else {
        setSelectedCliente(null);
      }
    } else {
      setSelectedCliente(null);
    }

    setTempItems(tempItemsFormatados);
    recalcularTotais(tempItemsFormatados);
    calcularResumoEspecies(tempItemsFormatados);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta saída?")) {
      try {
        const itensToDelete = saidaItens.filter(item => item.saida_id === id);
        for (const item of itensToDelete) {
          await retryWithDelay(() => SaidaItem.delete(item.id));
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        await retryWithDelay(() => Saida.delete(id));
        loadData();
      } catch (error) {
        console.error("Erro ao excluir saída:", error);
        let errorMsg = "Erro ao excluir saída. Por favor, tente novamente.";
        if (error.response?.status === 429 || error.message?.includes('429')) {
          errorMsg = "Sistema temporariamente ocupado. Aguarde um momento e tente novamente.";
        }
        setError(errorMsg);
      }
    }
  };

  const resetForm = () => {
    setCurrentSaida({
      numero_registro: "", data: new Date().toISOString().split('T')[0], dvpf_id: null,
      explorador_id: "", romaneador_id: "", veiculo_id: "", volume_florestal_total: 0,
      volume_comercial_total: 0, observacoes: ""
    });
    resetCurrentItemState();
    setTempItems([]);
    setEspeciesSummary({});
    setIsEditing(false); setError(null); setFeedback(null);
    setDuplicateWarning(null); setIsEditingItem(false); setEditingItemId(null);
    setSelectedCliente(null);
  };

  const getExplorador = (id) => exploradores.find(e => e.id === id);
  const getRomaneador = (id) => romaneadores.find(r => r.id === id);
  const getVeiculo = (id) => veiculos.find(v => v.id === id);
  const getEspecie = (id) => especies.find(e => e.id === id);
  const getCliente = (id) => clientes.find(c => c.id === id);
  const getDVPF = (id) => dvpfs.find(d => d.id === id);

  const extractNumericPart = (idStr) => {
    if (!idStr || typeof idStr !== 'string') return 0;
    const match = idStr.match(/\d+$/);
    if (match) return parseInt(match[0], 10);
    if (/^\d+$/.test(idStr)) return parseInt(idStr, 10);
    return 0;
  };

  const generatePDF = (saidaToPrint) => {
    const explorador = getExplorador(saidaToPrint.explorador_id);
    const romaneador = getRomaneador(saidaToPrint.romaneador_id);
    const veiculo = getVeiculo(saidaToPrint.veiculo_id);
    let clienteInfo = { nome: "N/A", cpf_cnpj: "N/A" };
    let dvpfInfo = { numero: "N/A" };
    if (saidaToPrint.dvpf_id) {
      const dvpf = getDVPF(saidaToPrint.dvpf_id);
      if (dvpf) {
        dvpfInfo = dvpf;
        const cliente = getCliente(dvpf.cliente_id);
        if (cliente) clienteInfo = cliente;
      }
    }
    const itensDoRomaneio = saidaItens
      .filter(item => item.saida_id === saidaToPrint.id)
      .sort((a, b) => {
        const dateA = a.created_date ? new Date(a.created_date).getTime() : null;
        const dateB = b.created_date ? new Date(b.created_date).getTime() : null;
        if (dateA && dateB && dateA !== dateB) return dateA - dateB;
        if (a.numero_arvore !== b.numero_arvore) return a.numero_arvore - b.numero_arvore;
        return (a.seccao || "").localeCompare(b.seccao || "");
      });

    let htmlContent = `
      <html><head><title>Romaneio de Saída ${saidaToPrint.numero_registro}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 10px; }
        .header, .footer { text-align: center; margin-bottom: 10px; }
        .info-section { margin-bottom: 10px; border: 1px solid #ccc; padding: 8px; }
        .info-section h3 { margin-top: 0; font-size: 12px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .info-grid strong { display: block; margin-bottom: 1px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px; }
        th, td { border: 1px solid #ddd; padding: 3px; text-align: left; }
        th { background-color: #f2f2f2; }
        .text-right { text-align: right; } .text-center { text-align: center; }
        .total-row td { font-weight: bold; background-color: #f9f9f9; }
        .summary-table th, .summary-table td { padding: 3px; }
      </style></head><body>
      <div class="header"><h2>Romaneio de Saída de Madeira</h2></div>
      <div class="info-section"><h3>Dados do Romaneio</h3>
        <div class="info-grid">
          <div><strong>Nº Romaneio:</strong> ${saidaToPrint.numero_registro}</div>
          <div><strong>Data:</strong> ${format(new Date(saidaToPrint.data + 'T00:00:00'), 'dd/MM/yyyy')}</div>
          <div><strong>Explorador:</strong> ${explorador?.nome || 'N/A'}</div>
          <div><strong>Romaneador:</strong> ${romaneador?.nome || 'N/A'}</div>
          <div><strong>Veículo:</strong> ${veiculo?.placa_cavalo || 'N/A'}</div>
          <div><strong>Motorista:</strong> ${veiculo?.nome_motorista || 'N/A'}</div>
          <div><strong>DVPF Nº:</strong> ${dvpfInfo.numero}</div>
          <div><strong>Cliente:</strong> ${clienteInfo.nome}</div>
          <div><strong>CPF/CNPJ Cliente:</strong> ${clienteInfo.cpf_cnpj}</div>
        </div>
        ${saidaToPrint.observacoes ? `<p><strong>Observações:</strong> ${saidaToPrint.observacoes}</p>` : ''}
      </div>
      <div class="info-section"><h3>Itens do Romaneio</h3><table><thead><tr>
        <th>Nº Árv.</th><th>Seç.</th><th>Espécie</th>
        <th class="text-right">D1(cm)</th><th class="text-right">D2(cm)</th><th class="text-right">C1(m)</th><th class="text-right">Vol.Flor.</th>
        <th class="text-right">D3(cm)</th><th class="text-right">C2(m)</th><th class="text-right">Vol.Com.</th>
        <th class="text-center">Dorm.</th></tr></thead><tbody>`;
    const resumoEspeciesPdf = {};
    let totalArvores = 0;
    itensDoRomaneio.forEach(item => {
      // Use entradaItensIdMap for faster lookup
      const entradaItemOriginal = entradaItensIdMap.get(item.entrada_item_id);
      const especie = getEspecie(item.especie_id);
      totalArvores++;
      htmlContent += `<tr>
          <td>${item.numero_arvore}</td><td class="text-center">${item.seccao}</td>
          <td>${especie ? `${especie.codigo || ''} - ${especie.nome}` : 'N/A'}</td>
          <td class="text-right">${formatarNumero(entradaItemOriginal?.diametro1, 1)}</td>
          <td class="text-right">${formatarNumero(entradaItemOriginal?.diametro2, 1)}</td>
          <td class="text-right">${formatarNumero(entradaItemOriginal?.comprimento1, 2)}</td>
          <td class="text-right">${formatarNumero(item.volume_florestal, 4)}</td>
          <td class="text-right">${formatarNumero(entradaItemOriginal?.diametro3, 1)}</td>
          <td class="text-right">${formatarNumero(entradaItemOriginal?.comprimento2, 2)}</td>
          <td class="text-right">${formatarNumero(item.volume_comercial, 4)}</td>
          <td class="text-center">${entradaItemOriginal?.is_dormente ? 'Sim' : 'Não'}</td></tr>`;
      if (especie) {
        if (!resumoEspeciesPdf[especie.id]) {
          resumoEspeciesPdf[especie.id] = { nome: `${especie.codigo || ''} - ${especie.nome}`, qtd: 0, volFlor: 0, volCom: 0 };
        }
        resumoEspeciesPdf[especie.id].qtd++;
        resumoEspeciesPdf[especie.id].volFlor += parseFloat(item.volume_florestal || 0);
        resumoEspeciesPdf[especie.id].volCom += parseFloat(item.volume_comercial || 0);
      }
    });
    const totalVolumeFlorestalGeral = itensDoRomaneio.reduce((sum, item) => sum + parseFloat(item.volume_florestal || 0), 0);
    const totalVolumeComercialGeral = itensDoRomaneio.reduce((sum, item) => sum + parseFloat(item.volume_comercial || 0), 0);
    htmlContent += `</tbody><tfoot class="total-row"><tr>
        <td colspan="6" class="text-right">TOTAIS GERAIS:</td>
        <td class="text-right">${totalVolumeFlorestalGeral.toFixed(4)}</td>
        <td colspan="2"></td>
        <td class="text-right">${totalVolumeComercialGeral.toFixed(4)}</td><td></td></tr></tfoot></table></div>
      <div class="info-section"><h3>Resumo por Espécie</h3><table class="summary-table"><thead><tr>
        <th>Espécie</th><th class="text-center">Qtd. Peças</th>
        <th class="text-right">Volume Florestal (m³)</th><th class="text-right">Volume Comercial (m³)</th></tr></thead><tbody>`;
    let totalQtdResumo = 0, totalVolFlorResumo = 0, totalVolComResumo = 0;
    Object.values(resumoEspeciesPdf).sort((a,b) => a.nome.localeCompare(b.nome)).forEach(resumo => {
      htmlContent += `<tr><td>${resumo.nome}</td><td class="text-center">${resumo.qtd}</td>
          <td class="text-right">${resumo.volFlor.toFixed(4)}</td><td class="text-right">${resumo.volCom.toFixed(4)}</td></tr>`;
      totalQtdResumo += resumo.qtd; totalVolFlorResumo += resumo.volFlor; totalVolComResumo += resumo.volCom;
    });
    htmlContent += `</tbody><tfoot class="total-row"><tr>
        <td class="text-right">TOTAIS RESUMO:</td><td class="text-center">${totalQtdResumo}</td>
        <td class="text-right">${totalVolFlorResumo.toFixed(4)}</td><td class="text-right">${totalVolComResumo.toFixed(4)}</td></tr></tfoot></table>
        <p><strong>Quantidade Total de Peças no Romaneio:</strong> ${totalArvores}</p></div>
      <div class="footer"><p>Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p></div></body></html>`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const renderSaidaDetails = (saidaId) => {
    const saida = saidas.find(s => s.id === saidaId);
    if (!saida) return <TableRow><TableCell colSpan={9}>Saída não encontrada.</TableCell></TableRow>;

    const itensDaSaida = saidaItens.filter(item => item.saida_id === saidaId);
    const explorador = getExplorador(saida.explorador_id);
    const romaneador = getRomaneador(saida.romaneador_id);
    const veiculo = getVeiculo(saida.veiculo_id);
    const dvpf = getDVPF(saida.dvpf_id);
    const cliente = dvpf ? getCliente(dvpf.cliente_id) : null;

    const resumoPorEspecieDetalhes = {};
    itensDaSaida.forEach(item => {
      const especie = getEspecie(item.especie_id);
      const especieKey = especie ? `${especie.codigo || 'SC'} - ${especie.nome}` : 'Desconhecida';
      if (!resumoPorEspecieDetalhes[especieKey]) {
        resumoPorEspecieDetalhes[especieKey] = { nome: especieKey, qtd: 0, volFlor: 0, volCom: 0 };
      }
      resumoPorEspecieDetalhes[especieKey].qtd++;
      resumoPorEspecieDetalhes[especieKey].volFlor += parseFloat(item.volume_florestal || 0);
      resumoPorEspecieDetalhes[especieKey].volCom += parseFloat(item.volume_comercial || 0);
    });

    return (
      <TableRow>
        <TableCell colSpan={9} className="bg-gray-50 p-0">
          <div className="p-4 space-y-3">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row justify-between items-start pb-3">
                    <div>
                        <CardTitle className="text-lg">Detalhes da Saída: {saida.numero_registro}</CardTitle>
                        <CardDescription>
                            Data: {format(new Date(saida.data + 'T00:00:00'), 'dd/MM/yyyy')} | DVPF: {dvpf?.numero || 'N/A'} | Cliente: {cliente?.nome || 'N/A'} <br/>
                            Explorador: {explorador?.nome || 'N/A'} | Romaneador: {romaneador?.nome || 'N/A'} | Veículo: {veiculo?.placa_cavalo || 'N/A'} ({veiculo?.nome_motorista || 'N/A'})
                            {saida.observacoes && <><br/>Obs: {saida.observacoes}</>}
                        </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDetailsVisible(null)} className="text-xs">
                        <X className="h-3 w-3 mr-1" /> Fechar
                    </Button>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="itens" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-3">
                      <TabsTrigger value="itens">Itens Lançados</TabsTrigger>
                      <TabsTrigger value="resumo">Resumo por Espécie</TabsTrigger>
                    </TabsList>
                    <TabsContent value="itens">
                      <div className="max-h-80 overflow-y-auto">
                        <Table size="sm" className="text-xs">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Árv.</TableHead>
                              <TableHead className="text-center">Seç.</TableHead>
                              <TableHead>Cód.Esp.</TableHead>
                              <TableHead>Espécie</TableHead>
                              <TableHead className="text-right">D1</TableHead>
                              <TableHead className="text-right">D2</TableHead>
                              <TableHead className="text-right">C1</TableHead>
                              <TableHead className="text-right">V.Flor.</TableHead>
                              <TableHead className="text-right">D3</TableHead>
                              <TableHead className="text-right">C2</TableHead>
                              <TableHead className="text-right">V.Com.</TableHead>
                              <TableHead className="text-center">Dorm.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itensDaSaida
                              .sort((a, b) => {
                                const dateA = a.created_date ? new Date(a.created_date).getTime() : null;
                                const dateB = b.created_date ? new Date(b.created_date).getTime() : null;
                                if (dateA && dateB && dateA !== dateB) return dateA - dateB;
                                if (a.numero_arvore !== b.numero_arvore) return a.numero_arvore - b.numero_arvore;
                                return (a.seccao || "").localeCompare(b.seccao || "");
                              })
                              .map(item => {
                                const especie = getEspecie(item.especie_id);
                                // Use entradaItensIdMap for faster lookup
                                const entradaItemOriginal = entradaItensIdMap.get(item.entrada_item_id);
                                return (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.numero_arvore}</TableCell>
                                    <TableCell className="text-center">{item.seccao}</TableCell>
                                    <TableCell>{especie?.codigo || '-'}</TableCell>
                                    <TableCell>{especie?.nome || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-mono">{formatarNumero(entradaItemOriginal?.diametro1, 1)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatarNumero(entradaItemOriginal?.diametro2, 1)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatarNumero(entradaItemOriginal?.comprimento1, 2)}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold text-green-700">{formatarNumero(item.volume_florestal, 4)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatarNumero(entradaItemOriginal?.diametro3, 1)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatarNumero(entradaItemOriginal?.comprimento2, 2)}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold text-blue-700">{formatarNumero(item.volume_comercial, 4)}</TableCell>
                                    <TableCell className="text-center">{entradaItemOriginal?.is_dormente ? 'Sim' : 'Não'}</TableCell>
                                  </TableRow>
                                );
                              })
                            }
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={7} className="text-right">TOTAIS:</TableCell>
                                <TableCell className="text-right font-mono">{formatarNumero(saida.volume_florestal_total, 4)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                                <TableCell className="text-right font-mono">{formatarNumero(saida.volume_comercial_total, 4)}</TableCell>
                                <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="resumo">
                        <Table size="sm" className="text-xs">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Espécie</TableHead>
                                    <TableHead className="text-center">Qtd. Peças</TableHead>
                                    <TableHead className="text-right">Volume Florestal (m³)</TableHead>
                                    <TableHead className="text-right">Volume Comercial (m³)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.values(resumoPorEspecieDetalhes).sort((a,b) => a.nome.localeCompare(b.nome)).map(resumo => (
                                    <TableRow key={resumo.nome}>
                                        <TableCell>{resumo.nome}</TableCell>
                                        <TableCell className="text-center">{resumo.qtd}</TableCell>
                                        <TableCell className="text-right font-mono font-semibold text-green-700">{formatarNumero(resumo.volFlor, 4)}</TableCell>
                                        <TableCell className="text-right font-mono font-semibold text-blue-700">{formatarNumero(resumo.volCom, 4)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                <TableRow className="bg-gray-100 font-bold">
                                    <TableCell className="text-right">TOTAIS:</TableCell>
                                    <TableCell className="text-center">
                                        {Object.values(resumoPorEspecieDetalhes).reduce((sum, r) => sum + r.qtd, 0)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatarNumero(Object.values(resumoPorEspecieDetalhes).reduce((sum, r) => sum + r.volFlor, 0), 4)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatarNumero(Object.values(resumoPorEspecieDetalhes).reduce((sum, r) => sum + r.volCom, 0), 4)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
            </Card>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const NO_DVPF_VALUE = "_NO_DVPF_";

  const handleDvpfChange = (selectedValue) => {
    const newDvpfId = selectedValue === NO_DVPF_VALUE ? null : selectedValue;
    setCurrentSaida(prev => ({ ...prev, dvpf_id: newDvpfId }));
    if (newDvpfId) {
      const dvpf = dvpfs.find(d => d.id === newDvpfId);
      if (dvpf) {
        const cliente = clientes.find(c => c.id === dvpf.cliente_id);
        setSelectedCliente(cliente || null);
      } else { setSelectedCliente(null); }
    } else { setSelectedCliente(null); }
  };

  const filteredSaidas = saidas.filter(saida => {
    const termoBusca = searchTerm.toLowerCase();
    const explorador = getExplorador(saida.explorador_id);
    const romaneador = getRomaneador(saida.romaneador_id);
    const veiculo = getVeiculo(saida.veiculo_id);
    let clienteNome = ""; let dvpfNumero = "";
    if (saida.dvpf_id) {
        const dvpf = getDVPF(saida.dvpf_id);
        if (dvpf) {
            dvpfNumero = dvpf.numero?.toLowerCase() || "";
            const cliente = getCliente(dvpf.cliente_id);
            clienteNome = cliente?.nome?.toLowerCase() || "";
        }
    }
    return (
        saida.numero_registro.toLowerCase().includes(termoBusca) ||
        (explorador?.nome?.toLowerCase() || '').includes(termoBusca) ||
        (romaneador?.nome?.toLowerCase() || '').includes(termoBusca) ||
        (veiculo?.placa_cavalo?.toLowerCase() || '').includes(termoBusca) ||
        (veiculo?.nome_motorista?.toLowerCase() || '').includes(termoBusca) ||
        clienteNome.includes(termoBusca) || dvpfNumero.includes(termoBusca)
    );
  });

  const renderFeedback = () => {
    if (!feedback) return null;
    return (
      <Alert variant={feedback.type === 'error' ? 'destructive' : (feedback.type === 'success' ? 'default': 'warning')}
             className={`text-xs p-2 ${feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : (feedback.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : '')}`}>
        {feedback.type === 'error' ? <AlertCircle className="h-3 w-3" /> : (feedback.type === 'success' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />)}
        <AlertDescription>{feedback.message}</AlertDescription>
      </Alert>
    );
  };

  const renderLoadingStatus = () => {
    if (dataLoadingStage === "complete") return null;

    const stageMessages = {
      "initial": "Inicializando...",
      "basic": "Carregando dados básicos...",
      "secondary": "Carregando informações de clientes...",
      "heavy": "Carregando dados de entrada e DVPFs...",
      "final": "Finalizando carregamento...",
      "error_basic": "Erro no carregamento inicial.",
      "error_secondary": "Erro no carregamento de dados secundários.",
      "error_heavy": "Erro no carregamento de dados pesados.",
      "error_final": "Erro no carregamento final."
    };

    const isErrorStage = dataLoadingStage.startsWith("error");

    return (
      <Alert className={isErrorStage ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}>
        {isErrorStage ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
        <AlertTitle className={isErrorStage ? "text-red-800" : "text-blue-800"}>
          {isErrorStage ? "Erro de Carregamento" : "Carregando Sistema"}
        </AlertTitle>
        <AlertDescription className={isErrorStage ? "text-red-700" : "text-blue-700"}>
          {stageMessages[dataLoadingStage] || "Carregando..."}
          {dataLoadingStage !== "basic" && !isErrorStage && " (Interface básica já disponível)"}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">Saída de Madeira</h1>
        <div className="flex gap-2">
          {retryCount > 0 && (
            <Button onClick={handleRetryLoad} variant="outline" className="border-blue-500 text-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          )}
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); setFeedback(null); }}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={dataLoadingStage !== "complete"}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova Saída
          </Button>
        </div>
      </div>

      {renderLoadingStatus()}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" /> <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}
            {(error.includes("sistema temporariamente") || error.includes("Muitas solicitações")) && (
              <p className="text-sm mt-1">
                O sistema está com alta demanda. Tente novamente em alguns instantes.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nº romaneio, DVPF, cliente, responsáveis, placa, motorista..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9"
          />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
            <p className="ml-2">Carregando saídas...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Roman.</TableHead><TableHead>Data</TableHead>
                  <TableHead className="hidden md:table-cell">Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">DVPF</TableHead>
                  <TableHead>Explorador</TableHead><TableHead>Romaneador</TableHead>
                  <TableHead className="hidden md:table-cell">Veículo</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Vol.Com.(m³)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSaidas.length > 0 ? (
                  filteredSaidas.map((saida) => {
                    let clienteNomeLista = "N/A", dvpfNumeroLista = "N/A";
                    if (saida.dvpf_id) {
                        const dvpf = getDVPF(saida.dvpf_id);
                        if (dvpf) {
                            dvpfNumeroLista = dvpf.numero;
                            const cliente = getCliente(dvpf.cliente_id);
                            if (cliente) clienteNomeLista = cliente.nome;
                        }
                    }
                    return (
                    <React.Fragment key={saida.id}>
                      <TableRow className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">{saida.numero_registro}</TableCell>
                        <TableCell>{saida.data && format(new Date(saida.data + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="hidden md:table-cell">{clienteNomeLista}</TableCell>
                        <TableCell className="hidden lg:table-cell">{dvpfNumeroLista}</TableCell>
                        <TableCell>{getExplorador(saida.explorador_id)?.nome || '-'}</TableCell>
                        <TableCell>{getRomaneador(saida.romaneador_id)?.nome || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell">{getVeiculo(saida.veiculo_id)?.placa_cavalo || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right font-mono">{saida.volume_comercial_total?.toFixed(4) || '0.0000'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleViewDetails(saida.id)} title="Ver detalhes" className="hover:bg-blue-100">
                              <FileText className="h-4 w-4 text-blue-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => generatePDF(saida)} title="Gerar PDF" className="hover:bg-green-100">
                              <Printer className="h-4 w-4 text-green-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(saida)} title="Editar" className="hover:bg-amber-100" disabled={dataLoadingStage !== "complete"}>
                              <Pencil className="h-4 w-4 text-amber-600" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(saida.id)} title="Excluir" className="hover:bg-red-100">
                              <Trash2 className="h-4 w-4 text-red-600" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {detailsVisible === saida.id && renderSaidaDetails(saida.id)}
                    </React.Fragment>
                  )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      {searchTerm ? "Nenhuma saída encontrada com os critérios de busca." : "Nenhuma saída cadastrada ainda."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) { if (!feedback?.type) resetForm(); }
        setIsDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <LogOut className="h-5 w-5 mr-2 text-emerald-600" />
              {isEditing ? `Editar Romaneio ${currentSaida.numero_registro}` : "Nova Saída de Madeira"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSaida} className="space-y-4 overflow-y-auto flex-grow p-1">
            {renderFeedback()}
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="info">Informações do Romaneio</TabsTrigger>
                <TabsTrigger value="itens" disabled={dataLoadingStage !== "complete"}>Lançamento de Árvores</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label htmlFor="numero_registro_saida_form">Número do Romaneio *</Label>
                    <Input id="numero_registro_saida_form" name="numero_registro" value={currentSaida.numero_registro} onChange={handleInputChange} required /></div>
                  <div><Label htmlFor="data_saida_form">Data *</Label>
                    <Input id="data_saida_form" name="data" type="date" value={currentSaida.data} onChange={handleInputChange} required /></div>
                  <div><Label htmlFor="dvpf_id_saida_form">DVPF</Label>
                    <Select value={currentSaida.dvpf_id || NO_DVPF_VALUE} onValueChange={handleDvpfChange}>
                      <SelectTrigger id="dvpf_id_saida_form"><SelectValue placeholder="Selecione uma DVPF" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DVPF_VALUE}>Nenhuma DVPF</SelectItem>
                        {dvpfs.map((dvpf) => (<SelectItem key={dvpf.id} value={dvpf.id}>{dvpf.numero}</SelectItem>))}
                      </SelectContent></Select></div>
                </div>
                {selectedCliente && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-2"><CardTitle className="text-md">Cliente da DVPF</CardTitle></CardHeader>
                    <CardContent><div className="flex flex-col gap-1">
                        <p className="text-lg font-semibold text-blue-800">{selectedCliente.nome}</p>
                        <p className="text-sm text-blue-700">CPF/CNPJ: {selectedCliente.cpf_cnpj}</p>
                        {selectedCliente.nome_contato && (<p className="text-sm text-blue-700">Contato: {selectedCliente.nome_contato}</p>)}
                    </div></CardContent></Card>)}
                {currentSaida.dvpf_id && dvpfSaldos[currentSaida.dvpf_id] && (
                  <Card className="bg-emerald-50 border-emerald-200">
                    <CardHeader className="pb-2"><CardTitle className="text-md">Saldo de Volume por Espécie (DVPF {dvpfSaldos[currentSaida.dvpf_id].numero})</CardTitle></CardHeader>
                    <CardContent><div className="max-h-40 overflow-y-auto"><Table size="sm"><TableHeader><TableRow>
                        <TableHead>Espécie</TableHead><TableHead className="text-right">Saldo (m³)</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {Object.entries(dvpfSaldos[currentSaida.dvpf_id].especies).map(([especieId, dados]) => {
                            const especie = getEspecie(especieId); const saldoInsuficiente = dados.saldo < 0;
                            return (<TableRow key={especieId} className={saldoInsuficiente ? "bg-red-100" : ""}>
                                <TableCell className={`font-medium ${saldoInsuficiente ? "text-red-700" : ""}`}>{especie ? `${especie.codigo} - ${especie.nome}` : 'Desconhecido'}</TableCell>
                                <TableCell className={`text-right font-mono ${saldoInsuficiente ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}`}>{formatarNumero(dados.saldo, 4)}</TableCell></TableRow>);})}
                          {Object.keys(dvpfSaldos[currentSaida.dvpf_id].especies).length === 0 && (<TableRow><TableCell colSpan={2} className="text-center text-gray-500">Nenhuma espécie na DVPF.</TableCell></TableRow>)}
                        </TableBody></Table></div>
                       {Object.values(dvpfSaldos[currentSaida.dvpf_id].especies).some(dados => dados.saldo < 0) && (
                          <Alert variant="destructive" className="mt-2 text-xs p-2"><AlertTriangle className="h-3 w-3" />
                            <AlertDescription>Atenção: Saldo negativo para uma ou mais espécies nesta DVPF.</AlertDescription></Alert>)}
                    </CardContent></Card>)}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label htmlFor="explorador_id_saida_form">Explorador *</Label>
                    <Select value={currentSaida.explorador_id} onValueChange={(value) => setCurrentSaida(prev => ({ ...prev, explorador_id: value }))} required>
                      <SelectTrigger id="explorador_id_saida_form"><SelectValue placeholder="Selecione um explorador" /></SelectTrigger>
                      <SelectContent>{exploradores.map((explorador) => (<SelectItem key={explorador.id} value={explorador.id}>{explorador.nome}</SelectItem>))}</SelectContent></Select></div>
                  <div><Label htmlFor="romaneador_id_saida_form">Romaneador *</Label>
                    <Select value={currentSaida.romaneador_id} onValueChange={(value) => setCurrentSaida(prev => ({ ...prev, romaneador_id: value }))} required>
                      <SelectTrigger id="romaneador_id_saida_form"><SelectValue placeholder="Selecione um romaneador" /></SelectTrigger>
                      <SelectContent>{romaneadores.map((romaneador) => (<SelectItem key={romaneador.id} value={romaneador.id}>{romaneador.nome}</SelectItem>))}</SelectContent></Select></div>
                  <div><Label htmlFor="veiculo_id_saida_form">Veículo *</Label>
                    <Select value={currentSaida.veiculo_id} onValueChange={handleVeiculoSelect} required>
                      <SelectTrigger id="veiculo_id_saida_form"><SelectValue placeholder="Selecione um veículo" /></SelectTrigger>
                      <SelectContent>{veiculos.map((veiculo) => (<SelectItem key={veiculo.id} value={veiculo.id}>{veiculo.placa_cavalo} - {veiculo.nome_motorista || "Sem motorista"}</SelectItem>))}</SelectContent></Select></div>
                </div>
                <div><Label htmlFor="observacoes_saida_form">Observações</Label>
                  <Textarea id="observacoes_saida_form" name="observacoes" value={currentSaida.observacoes} onChange={handleInputChange} rows={2} /></div>
                <Card><CardHeader className="pb-2"><CardTitle>Resumo de Volumes</CardTitle></CardHeader>
                  <CardContent><div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs font-medium text-gray-500">Vol. Florestal Total:</p><p className="text-xl font-bold text-emerald-700">{formatarNumero(currentSaida.volume_florestal_total, 4)} m³</p></div>
                      <div><p className="text-xs font-medium text-gray-500">Vol. Comercial Total:</p><p className="text-xl font-bold text-emerald-700">{formatarNumero(currentSaida.volume_comercial_total, 4)} m³</p></div>
                  </div></CardContent></Card>
              </TabsContent>
              <TabsContent value="itens" className="space-y-3 pt-4">
                {dataLoadingStage !== "complete" && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Aguarde o Carregamento Completo</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      O lançamento de árvores estará disponível após o carregamento completo dos dados de entrada.
                    </AlertDescription>
                  </Alert>
                )}
                 {feedback && (
                  <Alert variant={feedback.type === 'error' ? 'destructive' : (feedback.type === 'success' ? 'default': 'warning')} 
                         className={`text-xs p-2 ${feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : (feedback.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : '')}`}>
                    {feedback.type === 'error' ? <AlertCircle className="h-3 w-3" /> : (feedback.type === 'success' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />)}
                    <AlertDescription>{feedback.message}</AlertDescription>
                  </Alert>
                )}
                {duplicateWarning && (
                  <Alert variant="warning" className="bg-amber-50 border-amber-200 text-xs p-2">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <AlertDescription className="text-amber-700">
                      {duplicateWarning.mensagem}
                      {duplicateWarning.saidaRelacionada && (
                        <Button variant="link" className="text-amber-900 p-0 h-auto font-medium text-xs ml-1 underline"
                          onClick={() => { 
                            setIsDialogOpen(false); 
                            resetForm(); // Limpa o formulário atual
                            setTimeout(() => {
                              setDetailsVisible(null); // Fecha detalhes de outros romaneios
                              handleViewDetails(duplicateWarning.saidaRelacionada.id); // Abre detalhes do romaneio relevante
                            }, 100); 
                          }}>
                          Ver Romaneio Existente
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {dataLoadingStage === "complete" && (
                <Card><CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                      <div className="sm:col-span-1"><Label htmlFor="numero_arvore_saida_item_input" className="text-xs">Árvore *</Label>
                        <Input id="numero_arvore_saida_item_input" name="numero_arvore" value={currentItem.numero_arvore} onChange={handleItemInputChange} ref={numeroArvoreRef} onKeyDown={(e) => handleKeyPress(e, seccaoRef)} required={!isEditingItem} className="h-8 text-sm" /></div>
                      <div className="sm:col-span-1"><Label htmlFor="seccao_saida_item_input" className="text-xs">Secção *</Label>
                        <Input id="seccao_saida_item_input" name="seccao" value={currentItem.seccao} onChange={handleItemInputChange} ref={seccaoRef}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarDadosEntrada(currentItem.numero_arvore, currentItem.seccao).then(() => {
                                    const nextRef = currentItem.d3_saida_editavel ? null : adicionarItemRef;
                                    if (nextRef && nextRef.current) nextRef.current.focus(); else if (adicionarItemRef.current) adicionarItemRef.current.focus();});}}}
                          required={!isEditingItem} className="h-8 text-sm uppercase" maxLength={1} /></div>
                      <div className="sm:col-span-1"><Label className="text-xs">Espécie (Carregada)</Label>
                        <Input value={getEspecie(currentItem.especie_id_entrada)?.nome || ""} readOnly tabIndex={-1} className="h-8 text-sm bg-gray-100" /></div>
                      <div className="sm:col-span-1">
                        <Button type="button" onClick={handleAddItem} ref={adicionarItemRef} className={`w-full h-8 text-xs ${isEditingItem ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"}`}
                          disabled={!currentItem.entrada_item_id && !isEditingItem || loading}>
                           {isEditingItem ? <Pencil className="h-3 w-3 mr-1"/> : <Plus className="h-3 w-3 mr-1"/>}{isEditingItem ? "Atualizar" : "Add"}</Button></div></div>
                      {currentItem.entrada_item_id && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                            <div className="sm:col-span-1"><Label htmlFor="d3_saida_editavel_input" className="text-xs">D3 Saída (cm)</Label>
                                <Input id="d3_saida_editavel_input" name="d3_saida_editavel" type="number" step="0.1" value={currentItem.d3_saida_editavel} onChange={handleItemInputChange} className="h-8 text-sm" placeholder={currentItem.d3_entrada ? formatarNumero(currentItem.d3_entrada, 1) : "D3"} /></div>
                            <div className="sm:col-span-1"><Label htmlFor="c2_saida_editavel_input" className="text-xs">C2 Saída (m)</Label>
                                <Input id="c2_saida_editavel_input" name="c2_saida_editavel" type="number" step="0.01" value={currentItem.c2_saida_editavel} onChange={handleItemInputChange} className="h-8 text-sm" placeholder={currentItem.c2_entrada ? formatarNumero(currentItem.c2_entrada, 2) : "C2"} /></div></div>)}
                    {currentItem.entrada_item_id && (
                      <Card className="bg-blue-50 border-blue-200"><CardContent className="pt-2 pb-2">
                        {(() => { // Use entradaItensIdMap for faster lookup
                            const entradaItemOriginal = entradaItensIdMap.get(currentItem.entrada_item_id);
                            const especie = getEspecie(currentItem.especie_id_entrada);
                            if (!entradaItemOriginal) return <p className="text-xs text-gray-500">Dados não encontrados</p>;
                            return (<><div className="overflow-x-auto">
                                  <Table className="text-[11px] border-collapse -m-2"><TableHeader><TableRow className="border-b border-blue-100">
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap h-5">Árv.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-center h-5">Seç.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap h-5">Espécie</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-right h-5">D1 Ent.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-right h-5">D2 Ent.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-right h-5">C1 Ent.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-right h-5">V.Flor Ent.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-right h-5">D3 Ent.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-right h-5">C2 Ent.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-right h-5">V.Com Ent.</TableHead>
                                        <TableHead className="px-1 py-0.5 text-blue-800 font-semibold whitespace-nowrap text-center h-5">Dorm?</TableHead></TableRow></TableHeader>
                                    <TableBody><TableRow className="border-0">
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap font-mono h-5">{entradaItemOriginal.numero_arvore}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap font-mono h-5 text-center">{entradaItemOriginal.seccao}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap h-5" title={especie ? especie.nome : ''}>{especie ? `${especie.codigo}` : 'N/A'}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap text-right font-mono h-5">{formatarNumero(currentItem.d1_entrada, 1)}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap text-right font-mono h-5">{formatarNumero(currentItem.d2_entrada, 1)}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap text-right font-mono h-5">{formatarNumero(currentItem.c1_entrada, 2)}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-green-700 font-semibold whitespace-nowrap text-right font-mono h-5">{formatarNumero(currentItem.volume_florestal_entrada, 4)}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap text-right font-mono h-5">{formatarNumero(currentItem.d3_entrada, 1)}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap text-right font-mono h-5">{formatarNumero(currentItem.c2_entrada, 2)}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 font-semibold whitespace-nowrap text-right font-mono h-5">{formatarNumero(currentItem.volume_comercial_entrada, 4)}</TableCell>
                                        <TableCell className="px-1 py-0.5 text-blue-700 whitespace-nowrap text-center font-mono h-5">{currentItem.is_dormente_entrada ? 'Sim' : 'Não'}</TableCell></TableRow></TableBody></Table></div>
                                {currentItem.entrada_item_id && (<div className="text-xs mt-1 text-center">
                                    <span className="font-medium">Vol. Comercial Saída (Recalculado): </span>
                                    <span className="font-bold text-emerald-700">{formatarNumero(currentItem.volume_comercial_saida, 4)} m³</span></div>)}</>);})()}
                      </CardContent></Card>)}
                  {tempItems.length > 0 && (
                    <div className="mt-6"><h4 className="text-md font-semibold mb-2">Itens Lançados para esta Saída</h4>
                      <div className="overflow-y-auto overflow-x-auto border rounded-md max-h-[450px]">
                        <Table className="min-w-full text-xs"><TableHeader className="bg-gray-50 sticky top-0 z-10"><TableRow>
                              <TableHead className="px-2 py-2">Nº Árv.</TableHead><TableHead className="px-2 py-2">Seç.</TableHead>
                              <TableHead className="px-2 py-2">Espécie</TableHead>
                              <TableHead className="px-2 py-2 text-right">D1 Ent. (cm)</TableHead><TableHead className="px-2 py-2 text-right">D2 Ent. (cm)</TableHead>
                              <TableHead className="px-2 py-2 text-right">C1 Ent. (m)</TableHead><TableHead className="px-2 py-2 text-right">V.Flor Ent. (m³)</TableHead>
                              <TableHead className="px-2 py-2 text-right font-semibold">D3 Saída (cm)</TableHead><TableHead className="px-2 py-2 text-right font-semibold">C2 Saída (m)</TableHead>
                              <TableHead className="px-2 py-2 text-right font-semibold">V.Com Saída (m³)</TableHead><TableHead className="px-2 py-2 text-center">Dorm?</TableHead>
                              <TableHead className="px-2 py-2 text-center">Ações</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {tempItems.map((item, index) => (<TableRow key={item.id || `temp-${index}`} className={isEditingItem && editingItemId === item.id ? "bg-yellow-100" : ""}>
                                <TableCell className="px-2 py-1">{item.numero_arvore}</TableCell><TableCell className="px-2 py-1">{item.seccao}</TableCell>
                                <TableCell className="px-2 py-1">{item.especie_nome}</TableCell>
                                <TableCell className="px-2 py-1 text-right">{formatarNumero(item.d1_entrada, 1)}</TableCell><TableCell className="px-2 py-1 text-right">{formatarNumero(item.d2_entrada, 1)}</TableCell>
                                <TableCell className="px-2 py-1 text-right">{formatarNumero(item.c1_entrada, 2)}</TableCell><TableCell className="px-2 py-1 text-right">{formatarNumero(item.volume_florestal, 4)}</TableCell>
                                <TableCell className="px-2 py-1 text-right font-semibold">{formatarNumero(item.d3_saida, 1)}</TableCell><TableCell className="px-2 py-1 text-right font-semibold">{formatarNumero(item.c2_saida, 2)}</TableCell>
                                <TableCell className="px-2 py-1 text-right font-semibold">{formatarNumero(item.volume_comercial, 4)}</TableCell><TableCell className="px-2 py-1 text-center">{item.is_dormente ? "Sim" : "Não"}</TableCell>
                                <TableCell className="px-2 py-1 text-center"><div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditTempItem(item.id)} title="Editar item lançado" disabled={isEditingItem && editingItemId !== item.id}>
                                      <Pencil className="h-3 w-3 text-amber-600" /></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTempItem(item.id)} title="Remover item lançado" disabled={isEditingItem}>
                                      <Trash2 className="h-3 w-3 text-red-600" /></Button></div></TableCell></TableRow>))}
                          </TableBody></Table></div>
                      <div className="mt-2 flex justify-between items-center text-sm text-gray-600">
                        <div>Total de Itens Lançados: <span className="font-bold">{tempItems.length}</span></div>
                        <div className="text-right">
                          <p>Vol. Florestal Total: <span className="font-bold text-emerald-700">{formatarNumero(currentSaida.volume_florestal_total, 4)} m³</span></p>
                          <p>Vol. Comercial Total: <span className="font-bold text-emerald-700">{formatarNumero(currentSaida.volume_comercial_total, 4)} m³</span></p></div></div></div>)}
                  </CardContent></Card>)}
              </TabsContent></Tabs>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} disabled={loading}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading || tempItems.length === 0}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : (isEditing ? "Atualizar Romaneio" : "Cadastrar Romaneio")}</Button>
            </DialogFooter></form></DialogContent></Dialog></div>
  );
}
