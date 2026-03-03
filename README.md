# BPMN-Generator

Ein Repository zur Generierung von BPMN-Diagrammen.

Accepts structured JSON data (e.g. from CoPilot) and automatically generates BPMN 2.0 diagrams, which are displayed in a browser-based viewer.

---

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3000
```

---

## Data Format

Send a JSON object with the following fields to `POST /api/generate`:

| Field      | Type   | Required | Description                            |
|------------|--------|----------|----------------------------------------|
| `name`     | string | ✅       | Name of the process                    |
| `elements` | array  | ✅       | List of BPMN flow elements             |
| `flows`    | array  | ✅       | List of sequence flows between elements|

### Element object

| Field          | Type   | Required | Description                                      |
|----------------|--------|----------|--------------------------------------------------|
| `id`           | string | ✅       | Unique identifier                                |
| `type`         | string | ✅       | One of the supported types (see below)           |
| `name`         | string | ❌       | Display label                                    |
| `attachedToRef`| string | ❌ *     | Required for boundary events: id of the attached activity |

\* Required when `type` is a boundary event type.

**Supported element types:**

| Type                          | BPMN element                          |
|-------------------------------|---------------------------------------|
| `startEvent`                  | Start Event                           |
| `endEvent`                    | End Event                             |
| `task`                        | Generic Task                          |
| `userTask`                    | User Task                             |
| `serviceTask`                 | Service Task                          |
| `exclusiveGateway`            | Exclusive Gateway (XOR)               |
| `parallelGateway`             | Parallel Gateway (AND)                |
| `inclusiveGateway`            | Inclusive Gateway (OR)                |
| `intermediateTimerEvent`      | Timer Intermediate Catch Event        |
| `intermediateMessageEvent`    | Message Intermediate Catch Event      |
| `intermediateSignalEvent`     | Signal Intermediate Catch Event       |
| `intermediateConditionalEvent`| Conditional Intermediate Catch Event  |
| `intermediateThrowEvent`      | Intermediate Throw Event              |
| `intermediateMessageThrowEvent`| Message Intermediate Throw Event     |
| `intermediateSignalThrowEvent`| Signal Intermediate Throw Event       |
| `intermediateEscalationEvent` | Escalation Intermediate Throw Event   |
| `intermediateLinkEvent`       | Link Intermediate Throw Event         |
| `boundaryTimerEvent`          | Timer Boundary Event                  |
| `boundaryErrorEvent`          | Error Boundary Event                  |
| `boundaryMessageEvent`        | Message Boundary Event                |
| `boundarySignalEvent`         | Signal Boundary Event                 |

### Flow object

| Field    | Type   | Required | Description                   |
|----------|--------|----------|-------------------------------|
| `id`     | string | ✅       | Unique identifier             |
| `source` | string | ✅       | `id` of the source element    |
| `target` | string | ✅       | `id` of the target element    |
| `name`   | string | ❌       | Condition label               |

### Example

```json
{
  "name": "Bestellprozess",
  "elements": [
    { "id": "start1", "type": "startEvent",       "name": "Bestellung Eingang" },
    { "id": "task1",  "type": "userTask",          "name": "Bestellung prüfen" },
    { "id": "gw1",    "type": "exclusiveGateway",  "name": "Gültig?" },
    { "id": "task2",  "type": "serviceTask",       "name": "Bestellung bestätigen" },
    { "id": "timer1", "type": "intermediateTimerEvent", "name": "Warten 2 Tage" },
    { "id": "task3",  "type": "task",              "name": "Ablehnung benachrichtigen" },
    { "id": "boundary1", "type": "boundaryTimerEvent", "name": "Timeout", "attachedToRef": "task2" },
    { "id": "end1",   "type": "endEvent",          "name": "Ende" }
  ],
  "flows": [
    { "id": "flow1", "source": "start1",    "target": "task1" },
    { "id": "flow2", "source": "task1",     "target": "gw1" },
    { "id": "flow3", "source": "gw1",       "target": "task2",  "name": "Ja" },
    { "id": "flow4", "source": "gw1",       "target": "task3",  "name": "Nein" },
    { "id": "flow5", "source": "task2",     "target": "timer1" },
    { "id": "flow6", "source": "timer1",    "target": "end1" },
    { "id": "flow7", "source": "boundary1", "target": "task3" },
    { "id": "flow8", "source": "task3",     "target": "end1" }
  ]
}
```

---

## API

### `POST /api/generate`

**Request:** `Content-Type: application/json` — process definition JSON (see above).

**Response (200):** `Content-Type: application/xml` — BPMN 2.0 XML.

**Response (400):** `Content-Type: application/json` — `{ "error": "<message>" }` when the input is invalid.

---

## Running Tests

```bash
npm test
```

---

## Project Structure

```
├── index.js                  # Entry point
├── src/
│   ├── server.js             # Express server & /api/generate endpoint
│   └── bpmnGenerator.js      # JSON → BPMN 2.0 XML generator
├── public/
│   └── index.html            # Browser UI (bpmn-js viewer)
└── tests/
    ├── bpmnGenerator.test.js # Unit tests for the generator
    └── server.test.js        # Integration tests for the API
```
