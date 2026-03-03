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

| Field      | Type   | Required | Description                                        |
|------------|--------|----------|----------------------------------------------------|
| `name`     | string | ✅       | Name of the process                                |
| `elements` | array  | ✅       | List of BPMN flow elements                         |
| `flows`    | array  | ✅       | List of sequence flows between elements            |
| `pools`    | array  | ❌       | List of Pools (swimlane groups); enables collaboration mode |

### Element object

| Field          | Type   | Required | Description                                      |
|----------------|--------|----------|--------------------------------------------------|
| `id`           | string | ✅       | Unique identifier                                |
| `type`         | string | ✅       | One of the supported types (see below)           |
| `name`         | string | ❌       | Display label                                    |
| `attachedToRef`| string | ❌ *     | Required for boundary events: id of the attached activity |
| `laneRef`      | string | ❌ **    | Id of the Lane this element belongs to           |

\* Required when `type` is a boundary event type.  
\*\* Required only when `pools` with lanes are defined; the referenced lane id must exist.

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

### Pool object (`pools` array)

| Field    | Type   | Required | Description                                    |
|----------|--------|----------|------------------------------------------------|
| `id`     | string | ✅       | Unique identifier for the pool                 |
| `name`   | string | ❌       | Display label shown on the pool header         |
| `lanes`  | array  | ❌       | List of Lane objects contained within the pool |

### Lane object (inside a pool's `lanes` array)

| Field  | Type   | Required | Description                       |
|--------|--------|----------|-----------------------------------|
| `id`   | string | ✅       | Unique identifier for the lane    |
| `name` | string | ❌       | Display label shown on the lane   |

**Swimlane / Pool behaviour:**

- When `pools` is provided, the generator creates a BPMN 2.0 **Collaboration** wrapping each pool as a separate `bpmn:participant` and `bpmn:process`.
- Each pool may have one or more **Lanes** (horizontal swimlanes). Elements are assigned to a lane via their `laneRef` field.
- **Multiple pools** are supported; each pool gets its own process. Sequence flows between pools are automatically excluded (cross-pool communication would require BPMN Message Flows, which are not yet supported).
- Elements without a `laneRef` are placed into the first pool's process.
- The auto-layout engine positions elements left-to-right (by topological column) and centres them vertically within their lane band.

### Example (with Pools and Lanes)

```json
{
  "name": "Order Process",
  "pools": [
    {
      "id": "pool1",
      "name": "Customer",
      "lanes": [
        { "id": "lane_sales", "name": "Sales" },
        { "id": "lane_ops",   "name": "Operations" }
      ]
    }
  ],
  "elements": [
    { "id": "start1", "type": "startEvent",      "name": "Order received",  "laneRef": "lane_sales" },
    { "id": "task1",  "type": "userTask",         "name": "Review order",    "laneRef": "lane_sales" },
    { "id": "gw1",    "type": "exclusiveGateway", "name": "Valid?",          "laneRef": "lane_sales" },
    { "id": "task2",  "type": "serviceTask",      "name": "Confirm order",   "laneRef": "lane_ops"   },
    { "id": "task3",  "type": "task",             "name": "Reject order",    "laneRef": "lane_ops"   },
    { "id": "end1",   "type": "endEvent",         "name": "Done",            "laneRef": "lane_ops"   }
  ],
  "flows": [
    { "id": "f1", "source": "start1", "target": "task1" },
    { "id": "f2", "source": "task1",  "target": "gw1" },
    { "id": "f3", "source": "gw1",    "target": "task2", "name": "Yes" },
    { "id": "f4", "source": "gw1",    "target": "task3", "name": "No"  },
    { "id": "f5", "source": "task2",  "target": "end1" },
    { "id": "f6", "source": "task3",  "target": "end1" }
  ]
}
```

### Example (without Pools)

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
