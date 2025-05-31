import { format } from "date-fns";

export const formatters = {
  date: (value) => {
    try {
      return format(new Date(value), "dd/MM/yyyy");
    } catch {
      return "Data inválida";
    }
  },

  datetime: (value) => {
    try {
      return format(new Date(value), "dd/MM/yyyy HH:mm");
    } catch {
      return "Data inválida";
    }
  },

  volume: (value) => {
    return typeof value === 'number' 
      ? `${value.toFixed(3)} m³`
      : '0.000 m³';
  },

  currency: (value) => {
    return typeof value === 'number'
      ? `R$ ${value.toFixed(2)}`
      : 'R$ 0,00';
  }
};