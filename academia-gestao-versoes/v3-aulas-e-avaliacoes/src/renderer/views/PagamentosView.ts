import { chamar } from '../api';
import { ENTITIES, FORMAS_PAGAMENTO } from '../../shared/entities';
import type { PagamentoLinha, SessionUser } from '../../shared/types';
import { abrirDialogo, botao, dataBR, h, moeda, selo, toast, type Tom } from '../ui';
import { CrudView } from './CrudView';

const TOM: Record<string, Tom> = { pago: 'ok', pendente: 'aviso', atrasado: 'erro', cancelado: 'neutro' };

export class PagamentosView {
  constructor(private readonly usuario: SessionUser) {}

  async montar(raiz: HTMLElement): Promise<void> {
    const filtro = h('select', { 'aria-label': 'Filtrar pagamentos' },
      ...[['todos', 'Todos'], ['atrasados', 'Atrasados'], ['pendentes', 'A vencer'], ['pagos', 'Pagos']].map(([v, r]) => h('option', { value: v }, r)));
    filtro.value = 'atrasados';
    const view: CrudView = new CrudView(ENTITIES.pagamentos, this.usuario, {
      buscar: () => chamar<PagamentoLinha[]>('pagamentos:listar', { filtro: filtro.value }),
      extrasBarra: [filtro],
      colunas: [
        { titulo: 'Aluno', render: (l) => String(l.aluno_nome) },
        { titulo: 'Plano', render: (l) => String(l.plano_nome) },
        { titulo: 'Vencimento', render: (l) => dataBR(l.vencimento) },
        { titulo: 'Valor', render: (l) => moeda(Number(l.valor)) },
        { titulo: 'Situação', render: (l) => {
          const s = String(l.situacao);
          const texto = s === 'atrasado' ? `Atrasado há ${l.dias_atraso} dia${l.dias_atraso === 1 ? '' : 's'}` : s === 'pendente' ? 'A vencer' : s === 'pago' ? 'Pago' : 'Cancelado';
          return selo(texto, TOM[s] ?? 'neutro');
        } },
        { titulo: 'Pago em', render: (l) => dataBR(l.data_pagamento) },
      ],
      acoesLinha: (l, recarregar) => (l.situacao === 'pendente' || l.situacao === 'atrasado')
        ? [botao('Registrar pagamento', () => this.registrar(Number(l.id), recarregar), 'btn leve ok')] : [],
    });
    filtro.addEventListener('change', () => void view.recarregar());
    await view.montar(raiz);
  }

  private registrar(id: number, recarregar: () => Promise<void>): void {
    const forma = h('select', {}, ...FORMAS_PAGAMENTO.map((f) => h('option', { value: String(f.value) }, f.label)));
    const dlg = abrirDialogo('Registrar pagamento', h('label', { class: 'campo' }, h('span', {}, 'Forma de pagamento'), forma), [
      botao('Cancelar', () => dlg.close()),
      botao('Confirmar pagamento', () => void (async () => {
        try { await chamar('pagamentos:pagar', { id, forma: forma.value }); dlg.close(); toast('Pagamento registrado.'); await recarregar(); }
        catch (e) { toast(e instanceof Error ? e.message : 'Falha ao registrar.', 'erro'); }
      })(), 'btn primario'),
    ]);
  }
}
