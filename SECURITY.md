# Política de segurança · Security policy

## Versões com correção

| Versão | Recebe correções de segurança |
|---|---|
| 0.1.x | ✅ |

## Como relatar uma vulnerabilidade

**Não abra issue pública.** Relate em particular:

1. No GitHub, aba **Security → Report a vulnerability** (relato privado), ou
2. mensagem direta a um mantenedor.

Inclua: versão (ou commit), passos para reproduzir, impacto esperado e, se possível, uma prova de conceito mínima. Não acesse dados de terceiros nem degrade serviços de produção para testar.

Prazos que buscamos cumprir: confirmação em até **3 dias úteis**, avaliação inicial em até **7 dias** e correção conforme a gravidade (crítica: o quanto antes, com aviso coordenado). Quem relatar recebe crédito no CHANGELOG, se quiser.

O modelo de segurança da aplicação (sessão, CSRF, CSP, RBAC, anexos, rate limit, auditoria) está em [docs/security.md](docs/security.md).

---

**English:** please **do not open a public issue**. Report privately through GitHub (**Security → Report a vulnerability**) or by a direct message to a maintainer, with the affected version, reproduction steps and impact. We aim to acknowledge within 3 business days and assess within 7 days. See [docs/security.md](docs/security.md) for the security model.
