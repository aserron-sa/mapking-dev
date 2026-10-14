# Reporte de MCP, Skills, Plugins, Extensiones y Conectores

**Singular Agency**
**Operador:** Andrés Serrón (`aserron@singularagency.co`)
**Fecha de generación:** 2026-10-12

---

## 1. Ecosistema de Agentes, Skills y Telemetría de Singular Agency

En el entorno de automatización de Hyperagent para el proyecto **Map King** (gestionado por Singular Agency), se encuentran definidos los siguientes conectores, skills y servicios:

### A. Telemetría y Tracker Central de Singular Agency

* **Endpoint:** `https://singular-skill-tracker.singularagency.workers.dev/log`
* **Tipo:** Conector de telemetría HTTP / Cloudflare Worker.
* **Función:** Registro obligatorio al inicio de cada ejecución de skill/agente. Registra el nombre de la skill, usuario (`aserron@singularagency.co`), nombre (`Andrés Serrón`), origen (`hyperagent`) y equipo (`Map King`).
* **Seguridad:** Los usuarios fuera del dominio `@singularagency.co` reciben un `403` silencioso.
* **Políticas de Seguridad:** Todos los agentes aplican la **Sensitive Data Protection Policy** de Singular Agency (bloqueo automático de extracción o divulgación de datos sensibles como RRHH, compensaciones, términos financieros de clientes, disputas y PII).

---

### B. Agentes, Skills y Conectores / MCP en Hyperagent

| Agente / Skill               | Rol                                                        | Conectores / Integraciones / MCP                                                                                                                                                                                                                                                                                                                                                     | Configuración / Archivo                                                                                                                 |
| :--------------------------- | :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Loom** (Prompt v3.9) | Capa normalizada de tareas para el Command Center          | •**Attio:** OAuth (lectura de tareas de Sales)• **Linear:** OAuth (lectura de issues de Product)• **Google Calendar:** OAuth (eventos de Ops)• **Airtable:** Base `appcdpGNTo0DouoqJ` (`command_center_tasks`, `loom_sync_runs`)• **Slack:** Canal `#ingestion` (`C0BRF6AHDJQ`)                                                         | [`loom.agent.md`](../hyperagent/agents/loom/loom.agent.md) |
| **Ingestion Agent**    | Procesamiento y validación determinista de POIs desde CSV | •**Supabase MCP Server:** Custom MCP (URL + OAuth / Service Role) a `content_ingestion_staging` (proyecto `hdhgcgryrrqaaqmktgwg`, branch `qa`)• **Airtable MCP Server:** Base Map King Hub, tabla `ingestion_runs`• **Slack:** Disparador y confirmaciones en `#ingestion`• **Script Execution:** Validador determinista `ingestion-core.js` | [`agent-ingestion-agent.json`](../hyperagent/agent-ingestion-agent.json) |
| **Marrowback**         | Intake automation (Live schedule recurrente cada 1 hora)   | •**Attio:** Lectura de notas de deals• **Airtable:** Sincronización de notas y `context_summary`• **Slack:** Alertas en `#context-agent` / `C07596J0Y5V`                                                                                                                                                                                                 | [`marrowback.intake.md`](../hyperagent/agents/marrowback.intake.md) |
| **Proposal Drafter**   | Redacción y actualización de propuestas de ventas        | •**Airtable:** Detección de deals en etapas *Qualified* o *Won*• **Slack:** Aprobación en canal `C0BLQGR7NV8`                                                                                                                                                                                                                                                  | [`marrowback-proposal-drafter.live.cfg.md`](../hyperagent/agents/marrowback-proposal-drafter.live.cfg.md) |
| **Follow-Up Agent**    | Agente de seguimiento en ventas                            | •**Slack:** Bot identity y canales vinculados• **Airtable / CRM**                                                                                                                                                                                                                                                                                                      | [`marrowback-proposal-drafter.live.cfg.md`](../hyperagent/agents/marrowback-proposal-drafter.live.cfg.md#L40) |

---

## 2. Automatizaciones de Airtable (Omni Scripts / CCT)

En el directorio [`airtable/cct/automations`](../airtable/cct/automations), existen scripts y conectores internos desarrollados para Airtable Omni y el Command Center:

* [`task_lanes-integrity.js`](../airtable/cct/automations/task_lanes-integrity.js): Control de integridad, deduplicación y límite de tareas prioritarias (*top 3 on fire*).
* [`needs-you-waiting-since.js`](../airtable/cct/automations/needs-you-waiting-since.js) y [`needs-you-backfill.js`](../airtable/cct/automations/needs-you-backfill.js): Cálculo de tiempos de espera para tareas que requieren atención del operador.

---

## 3. Configuración de Identidad y Conexión SSH / Git

En la configuración local de tu entorno:

* **Git Config:** Configurado con tu identidad en `E:/projects/singular/.gitconfig`:
  * **Nombre:** Andrés Serrón
  * **Email:** `aserron@singularagency.co`
  * **SSH Command:** `ssh -i ~/.ssh/id_ed25519_singular_co_new -o IdentitiesOnly=yes`
* **SSH Config:** En `~/.ssh/config` (líneas 34–40), se encuentra el host `github-singular` asociado a la cuenta de GitHub `aserron-sa` y el repositorio remoto de trabajo `git@github.com:aserron-sa/mapking-dev.git`.

---

## 4. Servidores MCP y Plugins Locales en Antigravity CLI

* **Servidores MCP disponibles:**
  * `github-mcp-server`: Gestión de repositorios, PRs, issues y ramas con tu cuenta de GitHub.
  * `hostinger-*` (`dns`, `domains`, `hosting`, `reach`, `vps`): Conectores para infraestructura web y DNS.
  * `context7` (disponible localmente en `~/.gemini/antigravity-cli/mcp/context7`).
* **Plugins / Skills instalados:**
  * `hostinger-agent-skills`: Colección de skills de administración de servicios Hostinger.
  * `modern-web-guidance-plugin`: Incluye `modern-web-guidance` y `chrome-extensions`.
  * Skills base: `agy-customizations` y `antigravity-guide`.
