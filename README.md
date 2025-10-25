# JS-Syntax: Ein reaktives Mini-Framework

Dies ist ein leichtgewichtetes, reaktives Frontend-Framework, das für schnelle Prototypen und zum Erlernen von Kernkonzepten moderner Webentwicklung entwickelt wurde. Es verfügt über ein Live-Reloading-System, sodass Änderungen am Code sofort im Browser sichtbar werden.

## Features

- **Reaktives Datensystem:** Änderungen an lokalen und globalen Daten aktualisieren automatisch die Benutzeroberfläche.
- **Globaler State (Store):** Ein zentraler, reaktiver Store, um Daten über alle Komponenten hinweg zu teilen.
- **Komponenten-Architektur:** Baue deine Anwendung aus wiederverwendbaren, gekapselten Komponenten in `.jss`-Dateien.
- **Event-Handling:** Binde JavaScript-Methoden einfach an DOM-Events.
- **Scoped CSS:** Jede Komponente hat ihr eigenes, isoliertes Styling.
- **Live-Reloading:** Sofortige Updates im Browser bei Code-Änderungen.

## Der globale Store

Eine der mächtigsten Funktionen des Frameworks ist der globale, reaktive Store. Er ermöglicht es dir, einen Zustand (Daten) zentral zu verwalten und über alle deine Komponenten hinweg zu teilen.

Jede Komponente hat automatisch Zugriff auf ein spezielles `global`-Objekt. Wenn du Daten in diesem `global`-Objekt änderst, wird jede Komponente, die diese Daten verwendet, sofort und automatisch aktualisiert.

### Wie man den globalen Store verwendet

Du kannst im Template mit `{{ global.deineVariable }}` darauf zugreifen und in den Methoden mit `this.global.deineVariable`.

**Beispiel:** Eine Komponente zeigt den globalen Benutzernamen an, eine andere ändert ihn.

**Komponente 1: `user-profile` (zeigt Daten an)**
```html
<html name="user-profile">
<script>({ data: {}, methods: {} })</script>
<css>
  h2 { color: purple; }
</css>
<div>
  <h2>Willkommen zurück, {{ global.user }}!</h2>
</div>
</html>
```

**Komponente 2: `user-editor` (ändert Daten)**
```html
<html name="user-editor">
<script>
  ({
    data: {},
    methods: {
      updateUser(event) {
        // Hier wird der globale Zustand geändert!
        this.global.user = event.target.value;
      }
    }
  })
</script>
<div>
  <label>Benutzernamen ändern:</label>
  <input value="{{ global.user }}" data-event-updateUser="input">
</div>
</html>
```

In diesem Beispiel würde die Eingabe im `user-editor` sofort den Text im `user-profile` aktualisieren.

## Wie man Komponenten schreibt

Komponenten sind die Bausteine deiner Anwendung und werden in `.jss`-Dateien im `components`-Ordner definiert.

Jede Komponente besteht aus bis zu drei Teilen:

1.  **`<script>`:** Die Logik (lokale `data` und `methods`).
2.  **`<css>`:** Das gekapselte Styling.
3.  **HTML-Template:** Die Struktur.

### Beispiel einer Komponente

```html
<html name="counter-component">
<script>
  ({
    data: {
      counter: 0 // Dies ist ein lokaler Zustand
    },
    methods: {
      increment() {
        this.counter++;
      }
    }
  })
</script>
<css>
  h1 { color: blue; }
</css>
<div>
  <h1>Lokaler Zähler: {{ counter }}</h1>
  <button data-event-increment="click">+1</button>
</div>
</html>
```

## Syntax Highlighting

Dieses Projekt ist so konfiguriert, dass Syntax Highlighting für `.jss`-Dateien in modernen IDEs wie **Firebase Studio** oder **VS Code** automatisch aktiviert wird. Die Konfiguration dafür liegt in der `package.json`.

Sollte die Farb-Hervorhebung nicht sofort erscheinen, kann ein Neuladen des Editors das Problem lösen.
