
Ya guardé la configuración de **Marrowback** y **Proposal Drafter** en el documento de contexto del hilo. Estas son sus fichas:

**Marrowback — Live schedule**

| Ajuste                              | Valor                                                        |
| ----------------------------------- | ------------------------------------------------------------ |
| Check every                         | **1 hour** (~$4.99/día, ~$149.41/mes)                 |
| Deliver alerts to                   | Slack, canal**C07596J0Y5V**                            |
| Continues thread                    | Live mode thread, que al recrearlo será**New thread** |
| Only when something needs attention | On                                                           |
| Integration writes                  | Allow                                                        |
| Advanced                            | No se ve en la captura                                       |

Things to check:

```
For each client whose linked deal's deal_notes has changed since context_summary was last updated, draft a refreshed context_summary and post it in this thread for approval
```

**Proposal Drafter — Live schedule**

| Ajuste                              | Valor                                                        |
| ----------------------------------- | ------------------------------------------------------------ |
| Check every                         | **day** (~$0.21/día, ~$6.23/mes)                      |
| Deliver alerts to                   | Slack, canal**C0BLQGR7NV8**                            |
| Continues thread                    | Live mode thread, que al recrearlo será**New thread** |
| Only when something needs attention | On                                                           |
| Integration writes                  | Allow                                                        |
| Advanced                            | No se ve en la captura                                       |

Things to check:

```
Check for deals in stage 'Qualified' or 'Won' that don't yet have a linked proposal record, or whose deal_notes have been updated since the last proposal draft was written. For each one found, draft or refresh a proposal following the standard workflow, and post it for approval. Do not write anything to Airtable without explicit operator approval — this applies regardless of the Live mode write setting.
```

**Vi tres cosas que tienes que saber:**

1. **Todavía no borres estos dos.** En la lista de agentes, Follow-Up Agent ya no tiene la etiqueta "Live · paused", pero igual no te deja crear uno nuevo. Lo más probable es que borrar el schedule viejo dejó un registro huérfano que bloquea crear otro. Si borras los de Marrowback y Proposal Drafter, podría pasar lo mismo. Espera a que Support te responda sobre Follow-Up. En el mensaje pregúntales también si estos dos tienen una forma de traspaso que no deje nada bloqueando.
2. **Marrowback publica en un canal distinto del suyo.** Sus alertas iban a **C07596J0Y5V**, pero el acceso de Slack del agente es solo **#context-agent** (C0BLUB8JYHH). Las alertas las publica Hyperagent, así que puede ser intencional. Aun así, revisa cuál canal es C07596J0Y5V antes de recrearlo, porque vas a tener que elegirlo por nombre.
3. **Proposal Drafter no tiene integración de Slack**, pero entregaba a **C0BLQGR7NV8**. Para recrearlo probablemente tengas que configurar el Slack del agente como hiciste con Follow-Up: bot identity, el canal en Read and write y `/invite` en Slack.

**Me falta una cosa de cada uno:** baja hasta el final en los dos diálogos y despliega **Advanced**. Así veo el modelo y la opción de respuestas en Slack.

Si quieres, agrego estos dos agentes al mensaje para Support para que lo mandes todo junto.
