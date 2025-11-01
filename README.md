# digital-clock-card
Lovelace digital clock card for Home Assistant (HACS)
# Clock Ticks Card

Eine minimalistische Uhr-/Label-Karte mit Ticks für Home Assistant (Lovelace). HACS-kompatibel.

## Installation (HACS)
1. HACS → Frontend → Drei Punkte → **Benutzerdefiniertes Repository**  
   URL: https://github.com/<dein-user>/clock-ticks-card · Kategorie: **Lovelace**
2. `Clock Ticks Card` installieren.
3. (Falls Ressource nicht automatisch hinzugefügt wird)  
   Einstellungen → Dashboards → **Ressourcen** → **Hinzufügen**  
   URL: `/hacsfiles/clock-ticks-card/clock-ticks-card.js` · Typ: **JavaScript Modul**

## Nutzung
```yaml
type: custom:clock-ticks-card
entity: sensor.aktuelle_uhrzeit
cols: 6
rows: 2
