# "Sorry, but I can't assist" Problem beheben

## Problem

Die AI antwortet mit "Sorry, but I can't assist with that request" bei bestimmten Anfragen wie:
- "erstelle diagramm der letzten 20 jahre, brände in usa"
- "erstelle daraus ein diagramm"

## Ursache

Dies ist **kein App-Problem**, sondern ein Problem des LLM-Providers (LM Studio). Die Nachricht "Sorry, but I can't assist with that request" kommt direkt vom LLM-Modell, nicht von der Shadow IDE App.

LM Studio hat einen integrierten Content-Filter/Safety-Filter, der bestimmte Anfragen blockiert, wenn sie als sensibel oder unsicher eingestuft werden.

## Lösungen

### Lösung 1: Content-Filter in LM Studio deaktivieren

1. Öffne LM Studio
2. Gehe zu Settings (Einstellungen)
3. Suche nach "Content Filter" oder "Safety"
4. Deaktiviere den Filter oder stelle ihn auf "Permissive"

### Lösung 2: Anderes Modell verwenden

Manche Modelle haben strengere Filter als andere. Versuche:
- Ein Modell ohne Sicherheitsfilter
- Ein lokales Modell (z.B. Llama 3, Mistral)
- Ein Modell, das für Coding optimiert ist

### Lösung 3: Anfrage umformulieren

Manchmal blockiert der Filter bestimmte Wörter. Versuche die Anfrage umzuformulieren:
- Statt "brände in usa" → "feuerstatistik usa"
- Statt "diagramm der letzten 20 jahre" → "visualisierung der daten"

### Lösung 4: System-Prompt anpassen

In `src/config/chatConfig.ts` kannst du versuchen, den System-Prompt zu erweitern, um das Modell zu ermutigen, Diagramme zu erstellen:

Füge dies zu CORE_TRAITS hinzu:

```typescript
**IMPORTANT**: You CAN and SHOULD create visualizations, charts, and diagrams when users ask for them. Use the diagram widget syntax. Do not refuse requests for data visualization.
```

## Tasklisten-Funktionalität

Die Tasklisten-Funktionalität ist bereits implementiert. Die AI wird jetzt automatisch Tasklisten erstellen, wenn:
- Der Benutzer mehrere Aufgaben auf einmal fragt
- Eine Aufgabe aufgeteilt werden kann (z.B. "mach einen browser" → 1. Backend, 2. Frontend)
- Eine Aufgabe mehrere Schritte hat (z.B. "erstelle ein diagram und danach 3d block")

Dies wurde im System-Prompt in `src/config/chatConfig.ts` (Zeile 103-107) hinzugefügt.
