import { chamar, ApiError } from '../api';
import type { SessionUser } from '../../shared/types';
import { h } from '../ui';

/** Entrada no sistema. No primeiro acesso, cria o administrador (não existe senha padrão). */
export class LoginView {
  constructor(private readonly precisaConfigurar: boolean, private readonly aoEntrar: (u: SessionUser) => void) {}

  montar(raiz: HTMLElement): void {
    const novo = this.precisaConfigurar;
    const campo = (rotulo: string, tipo: string, nome: string, auto: string): [HTMLElement, HTMLInputElement] => {
      const i = h('input', { type: tipo, name: nome, required: true, autocomplete: auto });
      return [h('label', { class: 'campo' }, h('span', {}, rotulo), i), i];
    };
    const [lNome, nome] = campo('Seu nome', 'text', 'nome', 'name');
    const [lEmail, email] = campo('E-mail', 'email', 'email', 'username');
    const [lSenha, senha] = campo(novo ? 'Crie uma senha (8+ caracteres, letras e números)' : 'Senha', 'password', 'senha', novo ? 'new-password' : 'current-password');
    const erro = h('p', { class: 'erro-login', role: 'alert' });
    const form = h('form', { class: 'form-login', novalidate: true },
      h('h2', {}, novo ? 'Primeiro acesso' : 'Entrar'),
      novo ? h('p', { class: 'ajuda' }, 'Cadastre o administrador da academia. Ele poderá criar os demais usuários.') : null,
      novo ? lNome : null, lEmail, lSenha, erro,
      h('button', { class: 'btn primario grande', type: 'submit' }, novo ? 'Criar administrador' : 'Entrar'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      erro.textContent = '';
      void (async () => {
        try {
          const u = novo
            ? await chamar<SessionUser>('auth:configurar', { nome: nome.value, email: email.value, senha: senha.value })
            : await chamar<SessionUser>('auth:entrar', { email: email.value, senha: senha.value });
          this.aoEntrar(u);
        } catch (e) {
          erro.textContent = e instanceof ApiError ? (Object.values(e.campos ?? {})[0] ?? e.message) : 'Falha ao entrar.';
          senha.value = '';
        }
      })();
    });
    raiz.replaceChildren(h('main', { class: 'login' },
      h('div', { class: 'login-marca' },
        h('h1', {}, 'Gestão de Academia'),
        h('p', {}, 'Alunos, planos, aulas e mensalidades em um só lugar. Com aviso de chuva para as aulas ao ar livre.')),
      h('div', { class: 'login-form' }, form)));
    (novo ? nome : email).focus();
  }
}
