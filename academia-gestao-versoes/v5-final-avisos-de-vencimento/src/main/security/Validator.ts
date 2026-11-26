// Validação e limpeza dos dados recebidos da interface (CPF, e-mail, datas, números, senhas...).
import { AppError } from '../AppError';
import type { EntityDef, Field } from '../../shared/entities';
import { parseISODate, toISODate } from '../../shared/dates';
import { PasswordHasher } from './PasswordHasher';

// Dados já validados e normalizados
export type Limpo = Record<string, string | number | null>;

/** Validação e sanitização no processo main: o renderer nunca é confiável. */
export class Validator {
  // Valida o CPF pelos dígitos verificadores
  static cpfValido(cpf: string): boolean {
    const d = cpf.replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let soma = 0;
      for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
      if (((soma * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }

  /** Devolve só os campos declarados na entidade (impede "mass assignment"), já normalizados. */
  static limpar(def: EntityDef, entrada: Record<string, unknown>, modo: 'create' | 'update'): Limpo {
    const out: Limpo = {};
    const erros: Record<string, string> = {};
    // Percorre só os campos declarados na entidade (o resto é descartado)
    for (const f of def.fields) {
      if (f.readonly) continue;
      const bruto = entrada[f.name];
      const vazio = bruto === undefined || bruto === null || (typeof bruto === 'string' && bruto.trim() === '');
      if (vazio) {
        if (f.type === 'bool') out[f.name] = f.default === undefined ? 0 : Number(f.default);
        else if (f.required && !(f.virtual && modo === 'update')) erros[f.name] = 'Campo obrigatório.';
        else if (!f.virtual) out[f.name] = f.default !== undefined && modo === 'create' ? f.default : null;
        continue;
      }
      try {
        out[f.name] = Validator.converter(f, bruto);
      } catch (e) {
        erros[f.name] = e instanceof AppError ? e.message : 'Valor inválido.';
      }
    }
    if (Object.keys(erros).length) throw new AppError('Corrija os campos destacados.', erros);
    return out;
  }

  // Converte e valida um valor conforme o tipo do campo
  private static converter(f: Field, bruto: unknown): string | number {
    // Remove caracteres de controle e espaços das pontas (sanitização)
    const texto = String(bruto).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    const erro = (m: string): never => { throw new AppError(m); };
    switch (f.type) {
      // Texto livre com limite de tamanho
      case 'text': case 'textarea': {
        const max = f.maxLength ?? (f.type === 'textarea' ? 500 : 120);
        return texto.length > max ? erro(`Máximo de ${max} caracteres.`) : texto;
      }
      // E-mail com formato válido
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto) && texto.length <= 120 ? texto.toLowerCase() : erro('E-mail inválido.');
      // Telefone com DDD (10 a 13 dígitos)
      case 'tel': {
        const d = texto.replace(/\D/g, '');
        return d.length >= 10 && d.length <= 13 ? d : erro('Telefone inválido (DDD + número).');
      }
      // CPF válido, guardado só com números
      case 'cpf':
        return Validator.cpfValido(texto) ? texto.replace(/\D/g, '') : erro('CPF inválido.');
      // CEP com 8 dígitos
      case 'cep': {
        const d = texto.replace(/\D/g, '');
        return d.length === 8 ? d : erro('CEP deve ter 8 dígitos.');
      }
      // Número dentro do mínimo e do máximo
      case 'number': {
        const n = Number(String(bruto).replace(',', '.'));
        if (!Number.isFinite(n)) return erro('Número inválido.');
        if (f.min !== undefined && n < f.min) return erro(`Mínimo: ${f.min}.`);
        if (f.max !== undefined && n > f.max) return erro(`Máximo: ${f.max}.`);
        return n;
      }
      // Data real no formato AAAA-MM-DD
      case 'date':
        return /^\d{4}-\d{2}-\d{2}$/.test(texto) && toISODate(parseISODate(texto)) === texto ? texto : erro('Data inválida.');
      // Horário HH:MM
      case 'time':
        return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto) ? texto : erro('Horário inválido (HH:MM).');
      // Só aceita opções da lista
      case 'select': {
        const op = f.options?.find((o) => String(o.value) === texto);
        return op ? op.value : erro('Opção inválida.');
      }
      // Sim/não
      case 'bool':
        return bruto === true || bruto === 1 || texto === '1' || texto === 'true' ? 1 : 0;
      // Referência (id de outra tabela)
      case 'ref': {
        const n = Number(texto);
        return Number.isInteger(n) && n > 0 ? n : erro('Seleção inválida.');
      }
      // Senha segue a política mínima (8+ caracteres, letras e números)
      case 'password': {
        const msg = PasswordHasher.politica(String(bruto));
        return msg ? erro(msg) : String(bruto); // senha não é "trimada" nem alterada
      }
    }
  }
}
