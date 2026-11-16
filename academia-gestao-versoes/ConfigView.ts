import { chamar, ApiError } from '../api';
import type { Configuracoes } from '../../shared/types';
import { botao, h, toast } from '../ui';

export class ConfigView {
  async montar(raiz: HTMLElement): Promise<void> {
    let cfg = await chamar<Configuracoes>('config:obter');
    const campos: [keyof Configuracoes, string, string, Record<string, string>][] = [
      ['academiaNome', 'Nome da academia', 'text', {}],
      ['latitude', 'Latitude do espaço externo', 'number', { step: 'any' }],
      ['longitude', 'Longitude do espaço externo', 'number', { step: 'any' }],
      ['limiarChuva', 'Avisar a partir de (% de chance de chuva)', 'number', { min: '0', max: '100' }],
      ['horasAntecedencia', 'Olhar aulas das próximas (horas)', 'number', { min: '1', max: '72' }],
      ['diasAvisoVencimento', 'Planos “perto de vencer” (dias)', 'number', { min: '1', max: '60' }],
    ];
    const entradas = new Map<string, HTMLInputElement>();
    const erros = new Map<string, HTMLElement>();
    const grade = h('div', { class: 'grade-form' });
    for (const [chave, rotulo, tipo, attrs] of campos) {
      const i = h('input', { type: tipo, autocomplete: 'off', ...attrs });
      entradas.set(chave, i);
      const e = h('small', { class: 'erro-campo' });
      erros.set(chave, e);
      grade.append(h('label', { class: 'campo' }, h('span', {}, rotulo), i, e));
    }
    const preencher = (): void => {
      campos.forEach(([k]) => { entradas.get(k)!.value = String(cfg[k]); });
    };
    preencher();
    const salvar = async (extra: Record<string, unknown> = {}): Promise<void> => {
      erros.forEach((e) => { e.textContent = ''; });
      const dados: Record<string, unknown> = { ...extra };
      entradas.forEach((i, k) => { dados[k] = i.value; });
      try { cfg = await chamar<Configuracoes>('config:salvar', dados); preencher(); toast('Configurações salvas.'); }
      catch (e) {
        if (e instanceof ApiError && e.campos) Object.entries(e.campos).forEach(([k, m]) => { erros.get(k)!.textContent = m; });
        toast(e instanceof Error ? e.message : 'Não foi possível salvar.', 'erro');
      }
    };
    raiz.append(h('section', { class: 'painel' }, h('h2', {}, 'Clima e avisos'), grade,
      h('div', { class: 'acoes' }, botao('Salvar configurações', () => void salvar(), 'btn primario'))));
  }
}
