# Verbesserte Antwort für "Erstelle Diagramm der Feuer in Tirol letztes Jahr"

## Original Antwort (mit Problemen)
Ich kann leider keine visuelle Diagramme erstellen, aber ich kann dir den Code schreiben, der die feuer in Tirol letztes Jahr nachverwaltet. Dies ist eine einfache Python-Script, das die Feuerdaten der letzten Jahr aus der Tirolische Gemeindeverwaltung abrufen und schreibt sie in eine CSV-Datei.

## Probleme
- Grammatikfehler ("der feuer", "letztes Jahr nachverwaltet")
- Sagt "keine visuellen Diagramme" - aber wir haben jetzt DiagramWidget!
- Zu generisch ohne konkrete Daten
- Unvollständiger Code

## Verbesserte Antwort mit DiagramWidget

Hier ist ein Diagramm der Feuer in Tirol im letzten Jahr (Beispieldaten):

```diagram:bar
{"Januar": 12, "Februar": 8, "März": 15, "April": 22, "Mai": 35, "Juni": 48, "Juli": 62, "August": 58, "September": 41, "Oktober": 28, "November": 18, "Dezember": 14}
```

### Erklärung
Das Diagramm zeigt die Anzahl der Brände in Tirol monatlich für das letzte Jahr. Die Daten zeigen typischerweise:
- Höchste Brandzahlen im Sommer (Juni-August) aufgrund von Trockenheit
- Geringere Zahlen im Winter

### Python-Code zum Abrufen echter Daten
Wenn du echte Daten abrufen möchtest, kannst du diesen Python-Code verwenden:

```python
import requests
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

# Beispiel: Daten von einer offiziellen Quelle abrufen
# Hinweis: Du musst die tatsächliche API-URL der Tiroler Feuerwehr finden

def get_fire_data_tirol():
    """
    Ruft Feuerdaten von einer offiziellen Quelle ab
    """
    # Dies ist ein Beispiel - ersetze mit der echten API
    url = "https://api.bezirk.gv.at/feuerwehr/tirol"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            print(f"Fehler: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"Fehler beim Abrufen der Daten: {e}")
        return None

def create_fire_chart(data):
    """
    Erstellt ein Diagramm aus den Feuerdaten
    """
    if not data:
        # Fallback mit Beispieldaten
        data = {
            "Januar": 12, "Februar": 8, "März": 15, "April": 22,
            "Mai": 35, "Juni": 48, "Juli": 62, "August": 58,
            "September": 41, "Oktober": 28, "November": 18, "Dezember": 14
        }
    
    months = list(data.keys())
    fires = list(data.values())
    
    plt.figure(figsize=(12, 6))
    plt.bar(months, fires, color='orange', alpha=0.7)
    plt.xlabel('Monat')
    plt.ylabel('Anzahl der Brände')
    plt.title('Feuer in Tirol - Letztes Jahr')
    plt.xticks(rotation=45)
    plt.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig('feuer_tirol.png', dpi=300)
    plt.show()

# Verwendung
if __name__ == "__main__":
    fire_data = get_fire_data_tirol()
    create_fire_chart(fire_data)
```

### Datenquellen
Für echte Daten in Tirol kannst du folgende Quellen prüfen:
- Tiroler Landesfeuerwehrverband
- Statistik Austria
- Bezirksverwaltungen

### Hinweis
Das Diagramm oben zeigt Beispieldaten. Für genaue Zahlen musst du die offiziellen Statistiken der Tiroler Feuerwehr oder Statistik Austria konsultieren.
