# Behebung von Spamming und Diagramm-Problemen

## Problem 1: Diagramme werden nicht erstellt

### Lösung: Integration ist bereits aktiviert

Die ChatMessageWithWidgets-Komponente wurde bereits in `VirtualizedChatMessages.tsx` integriert:

```typescript
// In src/components/VirtualizedChatMessages.tsx
import ChatMessage from './ChatMessageWithWidgets';  // ← Bereits geändert
```

### Warum die AI noch keine Diagramme erstellt?

Die AI weiß noch nicht, dass sie die Widget-Syntax verwenden soll. Wir haben einen neuen System-Prompt erstellt in `src/config/widgetSystemPrompt.ts`.

#### Um den neuen Prompt zu aktivieren:

In `src/config/chatConfig.ts` müssen Sie den CORE_TRAITS um die Widget-Anweisungen erweitern. Da das Edit-Tool Probleme hat, hier der manuelle Schritt:

**Fügen Sie dies nach "### Web" in CORE_TRAITS hinzu (ca. Zeile 56-58):**

```typescript
### Interactive Widgets
You can create interactive widgets directly in the chat using special markdown syntax:

**Task Lists:**
\`\`\`tasklist
- [x] Completed task
- [ ] Pending task
\`\`\`

**Diagrams (Bar, Pie, Line):**
\`\`\`diagram:bar
{"Jan": 10, "Feb": 20, "Mar": 15}
\`\`\`

**3D Models:**
\`\`\`3d:cube
Description of the 3D model
\`\`\`

Use these widgets when users ask for visualizations, charts, or interactive elements.
```

**Fügen Sie dies am Ende von "How to work" hinzu (ca. Zeile 76):**

```typescript
8. **Avoid repetition.** Never repeat the same information multiple times. Each sentence should add new value.
```

## Problem 2: AI spammt die gleiche Nachricht

### Ursache

Das Spamming liegt in der Streaming-Logik in `src/components/LLMChat.tsx` in der `onUpdate` Funktion (ca. Zeile 4333).

### Lösung: Deduplizierungslogik hinzufügen

In der `onUpdate` Funktion in `LLMChat.tsx` (ca. Zeile 4333), fügen Sie diese Deduplizierungslogik direkt nach `currentContent = content;` hinzu:

```typescript
// Check for duplicate content to prevent spamming
const lastMessage = prev[prev.length - 1];
if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === content) {
  console.log('Duplicate content detected, skipping update');
  return prev;
}
```

### Vollständiger Kontext wo die Änderung hin muss:

```typescript
onUpdate: async (content: string) => {
  currentContent = content;
  console.log(`Streaming update: content length ${content.length}, currentContent now: ${currentContent.length}`);
  
  // ← HIER DIE DEDUPLIZIERUNGSLOGIK EINFÜGEN ↓
  
  setMessages(prev => {
    console.log(`Streaming callback: prev messages count: ${prev.length}`);
    // ... rest des Codes
```

## Schnelle Test-Methode

Um zu testen, ob die Diagramme funktionieren, können Sie manuell eine Nachricht mit der Widget-Syntax senden:

```
```diagram:bar
{"Januar": 12, "Februar": 8, "März": 15}
```
```

Wenn das Diagramm rechts im Chat angezeigt wird, funktioniert die Integration. Wenn nicht, überprüfen Sie:
1. Dass `VirtualizedChatMessages.tsx` `ChatMessageWithWidgets` importiert
2. Dass die Widget-Komponenten in `src/components/widgets/` existieren
3. Dass keine TypeScript-Fehler in der Konsole sind

## Alternative: Widget-System-Prompt direkt in chatConfig

Wenn Sie die CORE_TRAITS nicht bearbeiten können, können Sie auch einen neuen System-Prompt erstellen und ihn verwenden:

In `src/config/chatConfig.ts` fügen Sie hinzu:

```typescript
export const WIDGET_ENHANCED_SYSTEM: ExtendedMessage = {
  role: 'system',
  content: `${CORE_TRAITS}

### Interactive Widgets
You can create interactive widgets directly in the chat using special markdown syntax:

**Task Lists:**
\`\`\`tasklist
- [x] Completed task
- [ ] Pending task
\`\`\`

**Diagrams (Bar, Pie, Line):**
\`\`\`diagram:bar
{"Jan": 10, "Feb": 20, "Mar": 15}
\`\`\`

**3D Models:**
\`\`\`3d:cube
Description of the 3D model
\`\`\`

Use these widgets when users ask for visualizations, charts, or interactive elements.

8. **Avoid repetition.** Never repeat the same information multiple times. Each sentence should add new value.`,
  attachments: undefined
};
```

Dann in `LLMChat.tsx` statt `generateSystemMessage(getCurrentPromptsSettings())` verwenden:
```typescript
const initialSystemMessage = WIDGET_ENHANCED_SYSTEM;
```

## Zusammenfassung

1. **Diagramme**: Integration ist aktiv, aber AI weiß noch nicht wie → System-Prompt erweitern
2. **Spamming**: Deduplizierungslogik in onUpdate Funktion hinzufügen

Beide Änderungen sind klein und können manuell durchgeführt werden.
